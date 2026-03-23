import { FieldsConfig } from "./formBuilderTypes";

const SUPABASE_URL = "https://wenmrdqdmjidloivjycs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlbm1yZHFkbWppZGxvaXZqeWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDM2MjIsImV4cCI6MjA4NzUxOTYyMn0.bqYggYJwWABreY9MCx3vkHvSAbrXyBgVcL_X-dvcd_o";

export function generateLeadFormHTML(
  formName: string,
  product: string,
  bgColor = "transparent",
  textColor = "#111111",
  ownerId: string,
  formId: string,
  noSave = false,
  webhookUrl = "",
  hideFaturamento = false,
  hideArea = false,
  redirectUrl = "",
  noEmail = false,
  metaPixelId = "",
  gtmId = "",
  fieldsConfig: FieldsConfig | null = null,
  previewMode = false,
  metaCapiToken = ""
): string {
  // Safely serialize fields_config for embedding in JS
  const fieldsConfigJson = fieldsConfig
    ? JSON.stringify(fieldsConfig)
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$\{/g, "\\${")
    : "null";

  const script = `
try {
var SUPABASE_URL='${SUPABASE_URL}';
var SUPABASE_KEY='${SUPABASE_ANON_KEY}';
var OWNER_ID='${ownerId}';
var FORM_ID='${formId}';
var PRODUCT='${product.replace(/'/g, "\\'")}';
var NO_SAVE=${noSave ? "true" : "false"};
var WEBHOOK_URL='${webhookUrl.replace(/'/g, "\\'")}';
var HIDE_FATURAMENTO=${hideFaturamento ? "true" : "false"};
var HIDE_AREA=${hideArea ? "true" : "false"};
var REDIRECT_URL='${redirectUrl.replace(/'/g, "\\'")}';
var NO_EMAIL=${noEmail ? "true" : "false"};
var META_PIXEL_ID='${metaPixelId.replace(/'/g, "\\'")}';
var META_CAPI_TOKEN='${metaCapiToken.replace(/'/g, "\\'")}';
var TOTAL_STEPS=1;
var ACTIVE_STEPS=[];
var contactData={};
var OPT_REG={};
var Q="'"; /* used to embed single quotes inside onclick/onchange strings */
/* baked-in fields_config (used for preview; overridden by DB fetch for real forms) */
var FIELDS_CONFIG=${fieldsConfigJson};

var utmParams=(function(){
  try{
    var p=new URLSearchParams(window.location.search);
    return {
      utm_source:p.get('utm_source')||null,
      utm_medium:p.get('utm_medium')||null,
      utm_campaign:p.get('utm_campaign')||null,
      utm_content:p.get('utm_content')||null,
      utm_term:p.get('utm_term')||null
    };
  }catch(e){return{utm_source:null,utm_medium:null,utm_campaign:null,utm_content:null,utm_term:null};}
})();

function escH(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function getDefaultSteps(){
  var s=[];
  s.push({
    id:'s0',
    titleHTML:'Preencha seus <strong style="color:#111;">dados</strong> para continuar',
    fields:[
      {id:'fn',type:'text_short',key:'name',placeholder:'Nome completo *',required:true},
      {id:'fe',type:'text_short',key:'email',placeholder:'E-mail *',required:true},
      {id:'fp',type:'tel',key:'phone',placeholder:'WhatsApp / Telefone *',required:true}
    ]
  });
  if(!HIDE_FATURAMENTO){
    s.push({
      id:'s1',
      title:'Qual é o seu faturamento mensal?',
      subtitle:'Selecione a opção que melhor representa você',
      fields:[{
        id:'ff',type:'card',key:'faturamento',required:true,
        options:[
          {id:'o0',label:'Até R$ 3.000',sublabel:'Estou começando minha jornada'},
          {id:'o1',label:'De R$ 3.000 a R$ 5.000',sublabel:'Já tenho clientes e faturamento'},
          {id:'o2',label:'De R$ 5.000 a R$ 10.000',sublabel:'Negócio em crescimento'},
          {id:'o3',label:'Acima de R$ 10.000',sublabel:'Negócio consolidado'}
        ]
      }]
    });
  }
  if(!HIDE_AREA){
    s.push({
      id:'s2',
      title:'Qual é a sua área de atuação?',
      subtitle:'Nos conte em qual segmento da beleza você trabalha',
      fields:[{
        id:'fa',type:'card',key:'area_beleza',required:true,
        options:[
          {id:'a0',label:'Cílios',sublabel:'Lash designer, extensão de cílios'},
          {id:'a1',label:'Sobrancelhas',sublabel:'Designer de sobrancelhas, henna, micro'},
          {id:'a2',label:'Maquiagem',sublabel:'Make up artist, maquiadora'},
          {id:'a3',label:'Estética',sublabel:'Esteticista, skincare, tratamentos'},
          {id:'a4',label:'Cabelos',sublabel:'Cabeleireira, colorista, escovista'},
          {id:'a5',label:'Unhas',sublabel:'Manicure, nail designer, alongamento'},
          {id:'a6',label:'HOF (harmonização)',sublabel:'Harmonização orofacial, procedimentos'},
          {id:'a7',label:'Outro',sublabel:'Outro segmento da beleza'}
        ]
      }]
    });
  }
  return s;
}

function buildFieldHTML(field){
  var h='';
  var t=field.type;
  if(t==='text_short'||t==='tel'){
    h+='<div><input id="dfi-'+field.id+'" type="'+(t==='tel'?'tel':'text')+'"'+(t==='tel'?' name="tel"':'')+' placeholder="'+escH(field.placeholder||field.label||'')+'" /></div>';
  } else if(t==='text_long'){
    h+='<div><textarea id="dfi-'+field.id+'" placeholder="'+escH(field.placeholder||field.label||'')+'" rows="4" style="display:block;width:100%;border:1.5px solid #e5e7eb;border-radius:12px;padding:12px 16px;font-size:15px;color:#111;outline:none;background:#fff;font-family:inherit;resize:none;"></textarea></div>';
  } else if(t==='card'){
    OPT_REG[field.id]=field.options||[];
    h+='<div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding-right:4px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;">';
    (field.options||[]).forEach(function(opt,i){
      h+='<div id="dfo-'+field.id+'-'+i+'" class="fat-opt fat-opt-in" onclick="selectCardOpt('+Q+field.id+Q+','+i+')" style="animation-delay:'+i*60+'ms">';
      h+='<div class="fat-text"><strong>'+escH(opt.label)+'</strong>';
      if(opt.sublabel)h+='<span>'+escH(opt.sublabel)+'</span>';
      h+='</div><div class="fat-check"></div></div>';
    });
    h+='</div>';
    h+='<input type="hidden" id="dfi-'+field.id+'" value="" />';
  } else if(t==='radio'){
    OPT_REG[field.id]=field.options||[];
    h+='<div style="display:flex;flex-direction:column;gap:6px;">';
    (field.options||[]).forEach(function(opt,i){
      h+='<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;color:#374151;font-weight:500;">';
      h+='<input type="radio" name="dfr-'+field.id+'" value="'+escH(opt.label)+'" onchange="radioChanged('+Q+field.id+Q+')" style="accent-color:#111;width:16px;height:16px;flex-shrink:0;" />';
      h+=escH(opt.label);
      h+='</label>';
    });
    h+='</div>';
    h+='<input type="hidden" id="dfi-'+field.id+'" value="" />';
  } else if(t==='select'){
    h+='<select id="dfi-'+field.id+'" style="display:block;width:100%;height:54px;border:1.5px solid #e5e7eb;border-radius:12px;padding:0 16px;font-size:15px;color:#111;outline:none;background:#fff;font-family:inherit;">';
    h+='<option value="">Selecione...</option>';
    (field.options||[]).forEach(function(opt){
      h+='<option value="'+escH(opt.label)+'">'+escH(opt.label)+'</option>';
    });
    h+='</select>';
  }
  return h;
}

function buildSteps(){
  var steps=FIELDS_CONFIG&&FIELDS_CONFIG.steps&&FIELDS_CONFIG.steps.length>0?FIELDS_CONFIG.steps:getDefaultSteps();
  ACTIVE_STEPS=steps;
  TOTAL_STEPS=steps.length;
  var container=document.getElementById('form-steps-container');
  if(!container)return;
  container.innerHTML='';
  OPT_REG={};
  steps.forEach(function(step,idx){
    var div=document.createElement('div');
    div.id='dyn-step-'+idx;
    div.className='step anim';
    div.style.display='none';
    var h='';
    if(TOTAL_STEPS>1){
      var pct=Math.round(((idx+1)/TOTAL_STEPS)*100);
      h+='<div><div class="progress"><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%"></div></div><span class="progress-pct">'+pct+'%</span></div></div>';
    }
    if(step.titleHTML){
      h+='<div><p style="font-size:17px;color:#374151;line-height:1.5;">'+step.titleHTML+'</p></div>';
    } else if(step.title){
      h+='<div><p class="q-title">'+escH(step.title)+'</p>';
      if(step.subtitle)h+='<p class="q-sub">'+escH(step.subtitle)+'</p>';
      h+='</div>';
    }
    h+='<div id="step-err-'+idx+'" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;color:#dc2626;font-size:13px;"></div>';
    (step.fields||[]).forEach(function(field){h+=buildFieldHTML(field);});
    h+='<div class="btn-row">';
    if(idx>0){
      h+='<button class="btn-back" onclick="dynBack('+idx+')">&#8249; Voltar</button>';
    }
    var isLast=(idx===steps.length-1);
    h+='<button class="btn-primary" onclick="dynNext('+idx+')" '+(idx===0?'':'style="margin:0;"')+'>'+(isLast?'Enviar &#8250;':'Próximo &#8250;')+'</button>';
    h+='</div>';
    div.innerHTML=h;
    container.appendChild(div);
  });
  var first=document.getElementById('dyn-step-0');
  if(first)first.style.display='flex';
}

function setProgress(done){
  var pct=Math.round((done/TOTAL_STEPS)*100);
  document.querySelectorAll('.progress-fill').forEach(function(el){el.style.width=pct+'%';});
  document.querySelectorAll('.progress-pct').forEach(function(el){el.textContent=pct+'%';});
}

function selectCardOpt(fieldId,optIdx){
  var opts=OPT_REG[fieldId];
  if(!opts||!opts[optIdx])return;
  var val=opts[optIdx].label;
  var hidden=document.getElementById('dfi-'+fieldId);
  if(hidden)hidden.value=val;
  document.querySelectorAll('[id^="dfo-'+fieldId+'-"]').forEach(function(el){el.classList.remove('selected');});
  var sel=document.getElementById('dfo-'+fieldId+'-'+optIdx);
  if(sel)sel.classList.add('selected');
}

function radioChanged(fieldId){
  var inputs=document.querySelectorAll('[name="dfr-'+fieldId+'"]');
  var hidden=document.getElementById('dfi-'+fieldId);
  if(!hidden)return;
  inputs.forEach(function(inp){if(inp.checked)hidden.value=inp.value;});
}

function getFieldValue(field){
  var el=document.getElementById('dfi-'+field.id);
  if(!el)return'';
  return(el.value||'').trim();
}

function dynNext(stepIdx){
  var step=ACTIVE_STEPS[stepIdx];
  if(!step)return;
  var errEl=document.getElementById('step-err-'+stepIdx);
  var valid=true,errMsg='';
  for(var i=0;i<step.fields.length;i++){
    var f=step.fields[i];
    if(!f.required)continue;
    var v=getFieldValue(f);
    if(!v){errMsg='Preencha todos os campos obrigatórios';valid=false;break;}
    if(f.key==='email'&&v.indexOf('@')<0){errMsg='Preencha um e-mail válido';valid=false;break;}
  }
  if(!valid){
    if(errEl){errEl.textContent=errMsg;errEl.style.display='block';}
    return;
  }
  if(errEl){errEl.textContent='';errEl.style.display='none';}
  step.fields.forEach(function(f){
    var v=getFieldValue(f);
    if(v)contactData[f.key]=v;
  });
  var isLast=(stepIdx===ACTIVE_STEPS.length-1);
  if(isLast){
    setProgress(TOTAL_STEPS);
    var cur=document.getElementById('dyn-step-'+stepIdx);
    if(cur)cur.style.display='none';
    var ld=document.getElementById('step-loading');
    if(ld)ld.style.display='flex';
    window.scrollTo(0,0);
    doSubmit();
  } else {
    var curDiv=document.getElementById('dyn-step-'+stepIdx);
    if(curDiv)curDiv.style.display='none';
    var nextDiv=document.getElementById('dyn-step-'+(stepIdx+1));
    if(nextDiv){nextDiv.style.display='flex';}
    setProgress(stepIdx+2);
    window.scrollTo(0,0);
  }
}

function dynBack(stepIdx){
  var cur=document.getElementById('dyn-step-'+stepIdx);
  if(cur)cur.style.display='none';
  var prev=document.getElementById('dyn-step-'+(stepIdx-1));
  if(prev){prev.style.display='flex';}
  setProgress(stepIdx);
  window.scrollTo(0,0);
}

function showSuccess(){
  var stepLoading=document.getElementById('step-loading');
  if(stepLoading)stepLoading.style.display='none';
  var stepDone=document.getElementById('step-done');
  if(stepDone){
    stepDone.style.display='block';
    var sub=document.getElementById('success-sub');
    if(sub)sub.textContent=NO_EMAIL?'Seus dados foram enviados com sucesso':'Seu Ebook foi enviado ao seu email';
    var note=document.getElementById('success-note');
    if(note)note.style.display=NO_EMAIL?'none':'block';
  }
  if(REDIRECT_URL!=='none'){
    var dest=REDIRECT_URL||'https://biteti.co/acesso';
    setTimeout(function(){window.location.href=dest;},800);
  }
}

function showSubmitError(msg){
  var stepLoading=document.getElementById('step-loading');
  if(stepLoading)stepLoading.style.display='none';
  var stepErr=document.getElementById('step-error');
  if(stepErr){
    stepErr.style.display='block';
    var el=stepErr.querySelector('.err-msg');
    if(el)el.textContent=msg||'Erro ao enviar. Tente novamente.';
  }
}

function doSubmit(){
  var evId='lead_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  var stdKeys=['name','email','phone','faturamento','area_beleza'];
  var customFields={};
  Object.keys(contactData).forEach(function(k){
    if(stdKeys.indexOf(k)<0)customFields[k]=contactData[k];
  });
  var payload={
    owner_id:OWNER_ID,
    form_id:FORM_ID||null,
    product:PRODUCT||null,
    name:contactData.name||'',
    email:contactData.email||'',
    phone:contactData.phone||null,
    faturamento:contactData.faturamento||null,
    area_beleza:contactData.area_beleza||null,
    utm_source:utmParams.utm_source,
    utm_medium:utmParams.utm_medium,
    utm_campaign:utmParams.utm_campaign,
    utm_content:utmParams.utm_content,
    utm_term:utmParams.utm_term
  };
  if(Object.keys(customFields).length>0){payload.custom_fields=customFields;}
  var promises=[];
  if(!NO_SAVE){
    promises.push(
      fetch(SUPABASE_URL+'/rest/v1/form_submissions',{
        method:'POST',
        headers:{
          'apikey':SUPABASE_KEY,
          'Authorization':'Bearer '+SUPABASE_KEY,
          'Content-Type':'application/json',
          'Prefer':'return=minimal'
        },
        body:JSON.stringify(payload)
      }).then(function(res){
        if(!res.ok){return res.text().then(function(txt){throw new Error(txt);});}
        if(!NO_EMAIL){
          fetch(SUPABASE_URL+'/functions/v1/send-lead-email',{
            method:'POST',
            keepalive:true,
            headers:{
              'apikey':SUPABASE_KEY,
              'Authorization':'Bearer '+SUPABASE_KEY,
              'Content-Type':'application/json'
            },
            body:JSON.stringify({name:contactData.name||'',email:contactData.email||''})
          }).catch(function(e){console.warn('Email send failed:',e);});
        }
      })
    );
  }
  if(WEBHOOK_URL){
    promises.push(
      fetch(WEBHOOK_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      }).then(function(res){
        if(!res.ok){return res.text().then(function(txt){throw new Error('Webhook: '+txt);});}
      })
    );
  }
  if(promises.length===0){sendMetaEvents(evId).catch(function(){});showSuccess();return;}
  Promise.all(promises).then(function(){
    sendMetaEvents(evId).catch(function(){});
    showSuccess();
  }).catch(function(err){
    showSubmitError(err&&err.message?'Erro ao enviar: '+err.message:'Erro de conexão. Tente novamente.');
  });
}

function initForm(){
  var loader=document.getElementById('form-config-loader');
  if(loader)loader.style.display='none';
  buildSteps();
}

function initPixel(){
  if(!META_PIXEL_ID)return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init',META_PIXEL_ID);fbq('track','PageView');
}

async function sha256h(s){
  if(!s)return'';
  try{
    var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }catch(e){return'';}
}

async function sendMetaEvents(evId){
  if(!META_PIXEL_ID)return;
  try{
    var name=(contactData.name||'').trim();
    var parts=name.split(' ');
    var fn=parts[0]||'';
    var ln=parts.slice(1).join(' ')||'';
    var phone=(contactData.phone||'').replace(/[^0-9]/g,'');
    if(phone.length===10||phone.length===11){phone='55'+phone;}
    var em=(contactData.email||'').toLowerCase().trim();
    var hashes=await Promise.all([sha256h(em),sha256h(phone),sha256h(fn.toLowerCase()),sha256h(ln.toLowerCase())]);
    var ud={};
    if(hashes[0])ud.em=[hashes[0]];
    if(hashes[1])ud.ph=[hashes[1]];
    if(hashes[2])ud.fn=[hashes[2]];
    if(hashes[3])ud.ln=[hashes[3]];
    var cd={content_name:PRODUCT||'Lead Form',currency:'BRL'};
    if(window.fbq)fbq('track','Lead',cd,{eventID:evId});
    if(META_CAPI_TOKEN){
      fetch('https://graph.facebook.com/v21.0/'+META_PIXEL_ID+'/events?access_token='+encodeURIComponent(META_CAPI_TOKEN),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({data:[{event_name:'Lead',event_time:Math.floor(Date.now()/1000),event_id:evId,event_source_url:window.location.href,action_source:'website',user_data:ud,custom_data:cd}]})
      }).catch(function(){});
    }
  }catch(e){}
}

function startForm(){
  if(!FORM_ID||FORM_ID==='preview-temp'){initForm();return;}
  fetch(SUPABASE_URL+'/rest/v1/saved_forms?id=eq.'+FORM_ID+'&select=hide_faturamento,hide_area,no_save,webhook_url,redirect_url,no_email,no_redirect,fields_config,meta_pixel_id,meta_capi_token',{
    headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY}
  }).then(function(r){return r.json();}).then(function(data){
    if(data&&data[0]){
      var c=data[0];
      HIDE_FATURAMENTO=!!c.hide_faturamento;
      HIDE_AREA=!!c.hide_area;
      NO_SAVE=!!c.no_save;
      WEBHOOK_URL=c.webhook_url||'';
      NO_EMAIL=!!c.no_email;
      var ru=c.redirect_url||'';
      if(!ru&&c.no_redirect)ru='none';
      REDIRECT_URL=ru;
      if(c.fields_config&&c.fields_config.steps&&c.fields_config.steps.length>0){
        FIELDS_CONFIG=c.fields_config;
      }
      if(c.meta_pixel_id){META_PIXEL_ID=c.meta_pixel_id;}
      if(c.meta_capi_token){META_CAPI_TOKEN=c.meta_capi_token;}
    }
    initPixel();
    initForm();
  }).catch(function(){initPixel();initForm();});
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',startForm);
}else{
  startForm();
}
} catch(globalErr){ console.error('Form script error:',globalErr); }
`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${product}</title>
  ${!previewMode ? `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />` : ""}
  ${!previewMode && gtmId ? `<!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>
  <!-- End Google Tag Manager -->` : ""}
  ${!previewMode && metaPixelId ? `<!-- Meta Pixel -->
  <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');</script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/></noscript>
  <!-- End Meta Pixel -->` : ""}
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:${bgColor};color:${textColor};font-family:'Space Grotesk',sans-serif; }
    .wrap { width:100%;max-width:480px;margin:0 auto;padding:16px; }
    .step { display:flex;flex-direction:column;gap:14px; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes loadbar { 0%{transform:translateX(-100%)} 50%{transform:translateX(150%)} 100%{transform:translateX(-100%)} }
    .anim { animation:fadeIn 0.3s ease; }
    input[type=text],input[type=tel] {
      display:block;width:100%;height:54px;
      border:1.5px solid #e5e7eb;border-radius:12px;
      padding:0 16px;font-size:15px;color:#111;
      outline:none;background:#fff;
      font-family:'Space Grotesk',sans-serif;
      transition:border-color 0.2s;
    }
    input[type=text]:focus,input[type=tel]:focus { border-color:#e5e7eb; }
    .btn-primary {
      display:block;width:auto;min-width:180px;max-width:260px;
      height:50px;padding:0 36px;
      border-radius:999px;background:#111;color:#fff;
      font-size:15px;font-weight:600;border:none;cursor:pointer;
      font-family:'Space Grotesk',sans-serif;transition:opacity 0.2s;
      margin:0 auto;
    }
    .btn-primary:hover { opacity:0.85; }
    .btn-back {
      display:block;width:auto;min-width:110px;
      height:50px;padding:0 22px;
      border-radius:999px;background:transparent;color:#6b7280;
      font-size:15px;font-weight:500;border:1.5px solid #e5e7eb;cursor:pointer;
      font-family:'Space Grotesk',sans-serif;transition:all 0.2s;
    }
    .btn-back:hover { border-color:#bbb;color:#374151; }
    .btn-row { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px; }
    .fat-opt {
      display:flex;align-items:center;gap:10px;
      padding:10px 14px;
      border:1.5px solid #e5e7eb;border-radius:12px;
      font-size:13px;font-weight:500;color:#374151;
      cursor:pointer;background:#fff;
      transition:all 0.2s;
    }
    .fat-opt .fat-text { flex:1; }
    .fat-opt .fat-text strong { display:block;font-size:13px;font-weight:600;color:#111;margin-bottom:1px; }
    .fat-opt .fat-text span { font-size:11px;color:#9ca3af; }
    .fat-opt .fat-check { width:17px;height:17px;border-radius:50%;border:2px solid #e5e7eb;flex-shrink:0;transition:all 0.2s; }
    .fat-opt.selected { border-color:#111;background:#f8f8f8; }
    .fat-opt.selected .fat-check { background:#111;border-color:#111;box-shadow:inset 0 0 0 3px #fff; }
    @keyframes fatIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .fat-opt-in { opacity:0;animation:fatIn 0.32s ease forwards; }
    .q-title { font-size:18px;font-weight:700;color:#111; }
    .q-sub { font-size:13px;color:#888;margin-top:4px; }
    .progress { display:flex;align-items:center;gap:8px;margin-bottom:6px; }
    .progress-track { flex:1;height:3px;border-radius:99px;background:#e5e7eb;overflow:hidden; }
    .progress-fill { height:100%;border-radius:99px;background:#111;transition:width 0.4s ease; }
    .progress-pct { font-size:11px;color:#aaa;font-weight:500;white-space:nowrap;min-width:28px;text-align:right; }
  </style>
</head>
<body>
  ${!previewMode && gtmId ? `<!-- Google Tag Manager (noscript) --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><!-- End Google Tag Manager (noscript) -->` : ""}
<div class="wrap">

  <!-- Config loader -->
  <div id="form-config-loader" style="display:flex;align-items:center;justify-content:center;padding:80px 24px;">
    <div style="width:100%;max-width:220px;height:3px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
      <div style="height:100%;width:40%;background:#111;border-radius:99px;animation:loadbar 1.2s ease-in-out infinite;"></div>
    </div>
  </div>

  <!-- Dynamic steps (built by JS) -->
  <div id="form-steps-container"></div>

  <!-- Loading -->
  <div id="step-loading" style="display:none;text-align:center;padding:80px 24px;">
    <p style="color:#555;font-size:15px;font-weight:500;margin-bottom:20px;">Enviando seus dados...</p>
    <div style="width:100%;max-width:220px;margin:0 auto;height:3px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
      <div style="height:100%;width:40%;background:#111;border-radius:99px;animation:loadbar 1.2s ease-in-out infinite;"></div>
    </div>
  </div>

  <!-- Sucesso -->
  <div id="step-done" style="display:none;text-align:center;padding:48px 24px;">
    <h2 style="font-size:24px;font-weight:700;color:#111;margin-bottom:10px;">Dados Enviados</h2>
    <p id="success-sub" style="color:#555;font-size:15px;line-height:1.6;margin-bottom:24px;">Seu Ebook foi enviado ao seu email</p>
    <div style="width:100%;max-width:220px;margin:0 auto 12px;height:3px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
      <div style="height:100%;width:40%;background:#111;border-radius:99px;animation:loadbar 1.2s ease-in-out infinite;"></div>
    </div>
    <p id="success-note" style="color:#bbb;font-size:11px;letter-spacing:0.5px;">Não saia dessa tela</p>
  </div>

  <!-- Erro de envio -->
  <div id="step-error" style="display:none;text-align:center;padding:48px 24px;">
    <div style="font-size:36px;margin-bottom:16px;">⚠️</div>
    <h2 style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px;">Algo deu errado</h2>
    <p class="err-msg" style="color:#dc2626;font-size:13px;margin-bottom:16px;"></p>
    <button class="btn-primary" onclick="location.reload()" style="max-width:200px;margin:0 auto;">Tentar novamente</button>
  </div>

</div>
<script>
${script}
</script>
</body>
</html>`;
}
