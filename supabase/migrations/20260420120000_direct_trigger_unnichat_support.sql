-- Adiciona suporte ao step unnichat_webhook em nível de topo do flow na função
-- notify_whatsapp_on_submission. Antes desta migration, apenas clint_webhook e
-- os demais tipos (delay, message, audio, purchase_check) eram tratados; steps
-- unnichat_webhook no topo do flow eram silenciosamente ignorados (os jobs
-- unnichat_send só eram criados pelo resolve-purchase-check dentro de branches).
--
-- Resultado observado: formulários como Mentora Beauty, com flow
-- [clint_webhook, unnichat_webhook] no topo, disparavam só o Clint para novos
-- leads. Este fix enfileira também o job unnichat_send, exatamente no formato
-- que process_due_automation_jobs já sabe consumir.

CREATE OR REPLACE FUNCTION public.notify_whatsapp_on_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _automation  record;
  _steps       jsonb;
  _step        jsonb;
  _step_type   text;
  _delay_acc   interval;
  _phone       text;
  _phone_valid boolean;
  _lead_base   jsonb;
  _i           int;
BEGIN
  BEGIN
    -- Normaliza telefone; marca se é válido para steps que precisam (WhatsApp / Unnichat)
    _phone := regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g');
    IF length(_phone) IN (10, 11) THEN
      _phone       := '55' || _phone;
      _phone_valid := true;
    ELSIF length(_phone) IN (12, 13) THEN
      _phone_valid := true;
    ELSE
      _phone_valid := false;
      _phone := regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g');
    END IF;

    SELECT * INTO _automation
    FROM public.form_automations
    WHERE form_id = NEW.form_id AND enabled = true
    LIMIT 1;

    IF NOT FOUND THEN RETURN NEW; END IF;

    IF jsonb_array_length(coalesce(_automation.flow_steps, '[]'::jsonb)) > 0 THEN
      _steps := _automation.flow_steps;
    ELSIF _automation.message_template IS NOT NULL AND _automation.message_template <> '' THEN
      _steps := jsonb_build_array(
        jsonb_build_object('id','msg-0','type','message','message',_automation.message_template)
      );
    ELSE
      RETURN NEW;
    END IF;

    _lead_base := to_jsonb(NEW) || jsonb_build_object(
      '_zapi_instance_id',    coalesce(_automation.instance_id,    ''),
      '_zapi_instance_token', coalesce(_automation.instance_token, ''),
      '_zapi_client_token',   coalesce(_automation.client_token,   '')
    );

    _delay_acc := interval '0';

    FOR _i IN 0 .. (jsonb_array_length(_steps) - 1) LOOP
      _step      := _steps -> _i;
      _step_type := _step ->> 'type';

      IF _step_type = 'delay' THEN
        _delay_acc := _delay_acc + public.unit_to_interval(
          coalesce((_step->>'value')::int, 1),
          coalesce(_step->>'unit', 'minutes')
        );

      ELSIF _step_type = 'message' AND (_step->>'message') IS NOT NULL THEN
        IF NOT _phone_valid THEN CONTINUE; END IF;
        INSERT INTO public.automation_jobs
          (form_id, lead_id, lead_phone, lead_data, message, audio_url, job_type, scheduled_for, status)
        VALUES (
          NEW.form_id, NEW.id, _phone, _lead_base,
          _step->>'message', null, 'send',
          now() + _delay_acc, 'pending'
        );

      ELSIF _step_type = 'audio' AND (_step->>'audioUrl') IS NOT NULL THEN
        IF NOT _phone_valid THEN CONTINUE; END IF;
        INSERT INTO public.automation_jobs
          (form_id, lead_id, lead_phone, lead_data, message, audio_url, job_type, scheduled_for, status)
        VALUES (
          NEW.form_id, NEW.id, _phone, _lead_base,
          null, _step->>'audioUrl', 'send',
          now() + _delay_acc, 'pending'
        );

      ELSIF _step_type = 'clint_webhook' AND (_step->>'clintApiUrl') IS NOT NULL AND (_step->>'clintApiUrl') <> '' THEN
        INSERT INTO public.automation_jobs
          (form_id, lead_id, lead_phone, lead_data, message, audio_url, job_type, scheduled_for, status)
        VALUES (
          NEW.form_id, NEW.id,
          coalesce(nullif(_phone, ''), coalesce(NEW.phone, '')),
          _lead_base || jsonb_build_object(
            '_clint_api_url',        _step->>'clintApiUrl',
            '_clint_api_key',        coalesce(_step->>'clintApiKey', ''),
            '_clint_field_mappings', coalesce(_step->'clintFieldMappings', '[]'::jsonb)
          ),
          null, null, 'clint_send',
          now() + _delay_acc, 'pending'
        );

      ELSIF _step_type = 'unnichat_webhook' AND (_step->>'unnichatToken') IS NOT NULL AND (_step->>'unnichatToken') <> '' THEN
        -- Unnichat exige telefone válido pra criar contato
        IF NOT _phone_valid THEN CONTINUE; END IF;
        INSERT INTO public.automation_jobs
          (form_id, lead_id, lead_phone, lead_data, message, audio_url, job_type, scheduled_for, status)
        VALUES (
          NEW.form_id, NEW.id, _phone,
          _lead_base || jsonb_build_object(
            '_unnichat_token',     _step->>'unnichatToken',
            '_unnichat_crm_id',    coalesce(_step->>'unnichatCrmId',    ''),
            '_unnichat_column_id', coalesce(_step->>'unnichatColumnId', ''),
            '_unnichat_tag_id',    coalesce(_step->>'unnichatTagId',    '')
          ),
          null, null, 'unnichat_send',
          now() + _delay_acc, 'pending'
        );

      ELSIF _step_type = 'purchase_check' THEN
        IF NOT _phone_valid THEN CONTINUE; END IF;
        INSERT INTO public.automation_jobs
          (form_id, lead_id, lead_phone, lead_data, message, audio_url, job_type, scheduled_for, status)
        VALUES (
          NEW.form_id, NEW.id, _phone,
          _lead_base || jsonb_build_object(
            '_purchased_steps',     coalesce(_step->'purchasedSteps',    '[]'::jsonb),
            '_not_purchased_steps', coalesce(_step->'notPurchasedSteps', '[]'::jsonb)
          ),
          null, null, 'purchase_check',
          now() + _delay_acc + public.unit_to_interval(
            coalesce((_step->>'value')::int, 3),
            coalesce(_step->>'unit', 'minutes')
          ),
          'pending'
        );
        EXIT;
      END IF;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_whatsapp_on_submission error for submission %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_on_submission ON public.form_submissions;

CREATE TRIGGER trg_whatsapp_on_submission
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_on_submission();
