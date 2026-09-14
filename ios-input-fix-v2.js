(function(){
  window.addEventListener('DOMContentLoaded',()=>{
    const answer=document.getElementById('answer');
    if(!answer) return;

    // Leave the textarea completely alone while iOS is editing it.
    // In particular, never rewrite .value or the cursor/selection: doing that
    // during predictive-text composition causes letters to jump and scramble.
    function pauseUpdates(){
      try{ if(typeof stopPolling==='function') stopPolling(); }catch(e){}
    }

    function resumeUpdates(){
      setTimeout(()=>{
        try{
          if(typeof refresh==='function') refresh();
          if(typeof startPolling==='function') startPolling();
        }catch(e){}
      },500);
    }

    answer.addEventListener('focus',pauseUpdates);
    answer.addEventListener('touchstart',pauseUpdates,{passive:true});
    answer.addEventListener('pointerdown',pauseUpdates,{passive:true});
    answer.addEventListener('blur',resumeUpdates);
  });
})();
