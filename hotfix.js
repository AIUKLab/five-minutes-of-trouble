(function(){
  function removeNamedInvitePrompt(){
    const nodes=[document.getElementById('toast'),document.getElementById('who')].filter(Boolean);
    nodes.forEach(el=>{
      if(/send\s+vee\s+an\s+invite/i.test(el.textContent||'')) el.textContent='';
    });
  }

  window.addEventListener('DOMContentLoaded',()=>{
    removeNamedInvitePrompt();

    const answer=document.getElementById('answer');
    if(!answer) return;

    // iOS predictive text/composition gets corrupted if renderGame resets the
    // textarea value while the keyboard is active. Prevent all live refreshes
    // from rendering while this field has focus.
    const originalRefresh=window.refresh;
    if(typeof originalRefresh==='function'){
      window.refresh=async function(){
        if(document.activeElement===answer) return;
        return originalRefresh.apply(this,arguments);
      };
    }

    // Rebuild the polling interval so it uses the guarded refresh above.
    try{
      if(typeof stopPolling==='function') stopPolling();
      if(typeof startPolling==='function') startPolling();
    }catch(e){}

    answer.addEventListener('focus',()=>{
      try{ if(typeof stopPolling==='function') stopPolling(); }catch(e){}
    });

    answer.addEventListener('blur',()=>{
      setTimeout(async()=>{
        try{
          if(typeof originalRefresh==='function') await originalRefresh();
          if(typeof startPolling==='function') startPolling();
        }catch(e){}
      },300);
    });
  });
})();
