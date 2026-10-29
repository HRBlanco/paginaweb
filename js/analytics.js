(function(){
  // Google Analytics 4 (la etiqueta gtag.js se carga desde cada página)
  var GA_ID = 'G-PVWB06REQS';

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  // Privacidad: el sitio no usa publicidad, así que nunca se concede consentimiento de anuncios.
  // No hay aviso de cookies: en el Espacio Económico Europeo y Reino Unido la analítica queda desactivada.
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','CH','GB']
  });

  gtag('js', new Date());
  gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });

  // Registra un evento sin romper la página si Analytics está bloqueado.
  // Nunca se envían nombres, correos ni mensajes de las personas, solo que la acción ocurrió.
  window.medirEvento = function(nombre, params){
    try { gtag('event', nombre, params || {}); } catch(_) {}
  };

  // Clics en reservar, WhatsApp y correo
  document.addEventListener('click', function(event){
    var enlace = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!enlace) return;
    var href = enlace.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) {
      window.medirEvento('clic_correo');
    } else if (/wa\.me|api\.whatsapp\.com/i.test(href)) {
      window.medirEvento('clic_whatsapp');
    } else if (/(^|\/)agenda(\.html)?([?#]|$)/.test(href)) {
      var texto = (enlace.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      window.medirEvento('clic_reservar', { link_text: texto });
    }
  });
})();
