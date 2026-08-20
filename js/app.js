/*
 * Happynet frontend entry point.
 *
 * These files intentionally use classic scripts: the existing UI is a
 * browser application whose features share state and rendering helpers.
 * Keeping the load order explicit preserves those contracts while giving
 * each responsibility a focused home.
 */
(function loadApplicationModules(){
  const modules = [
    '01-icons.js',
    '02-api-auth.js',
    '03-resource-api-exports.js',
    '04-exports-attachments.js',
    '05-assistant-staff.js',
    '06-state.js',
    '07-business-logic.js',
    '08-control-center.js',
    '09-views.js',
    '10-wiring-boot.js'
  ];

  for(const moduleName of modules){
    const script = document.createElement('script');
    script.src = `/js/modules/${moduleName}`;
    script.async = false;
    document.write(script.outerHTML);
  }
})();
