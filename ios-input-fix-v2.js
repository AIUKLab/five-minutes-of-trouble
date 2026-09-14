(function(){
  let typing=false;
  let composing=false;
  let savedValue='';
  let savedStart=null;
  let savedEnd=null;

  function answerEl(){return document.getElementById('answer');}

  function saveDraft(){
    const a=answerEl();
    if(!a) return;
    savedValue=a.value;
    try{savedStart=a.selectionStart;savedEnd=a.selectionEnd;}catch(e){}
  }

  function restoreDraft(){
    const a=answerEl();
    if(!a) return;
    if(a.value!==savedValue) a.value=savedValue;
    if(savedStart!==null){
      try{a.setSelectionRange(savedStart,savedEnd);}catch(e){}
    }
  }

  function stopLiveUpdates(){
    typing=true;
    saveDraft();
    try{ if(typeof stopPolling==='function') stopPolling(); }catch(e){}
  }

  function restartLiveUpdates(){
    typing=false;
    composing=false;
    setTimeout(()=>{
      try{ if(typeof startPolling==='function') startPolling(); }catch(e){}
    },500);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const a=answerEl();
    if(!a) return;

    a.setAttribute('autocorrect','on');
    a.setAttribute('autocomplete','off');
    a.setAttribute('autocapitalize','sentences');
    a.setAttribute('spellcheck','true');

    a.addEventListener('pointerdown',stopLiveUpdates,{passive:true});
    a.addEventListener('touchstart',stopLiveUpdates,{passive:true});
    a.addEventListener('focus',stopLiveUpdates);
    a.addEventListener('beforeinput',()=>{stopLiveUpdates();saveDraft();});
    a.addEventListener('input',()=>{saveDraft();});
    a.addEventListener('compositionstart',()=>{composing=true;stopLiveUpdates();});
    a.addEventListener('compositionupdate',()=>{saveDraft();});
    a.addEventListener('compositionend',()=>{composing=false;saveDraft();});
    a.addEventListener('blur',restartLiveUpdates);

    const originalRender=window.renderGame;
    if(typeof originalRender==='function'){
      window.renderGame=function(){
        const active=document.activeElement===a || typing || composing;
        if(active){
          saveDraft();
          return;
        }
        return originalRender.apply(this,arguments);
      };
    }

    const originalRefresh=window.refresh;
    if(typeof originalRefresh==='function'){
      window.refresh=async function(){
        if(document.activeElement===a || typing || composing) return;
        return originalRefresh.apply(this,arguments);
      };
    }

    try{ if(typeof stopPolling==='function') stopPolling(); if(typeof startPolling==='function') startPolling(); }catch(e){}

    setInterval(()=>{
      if(document.activeElement===a || typing || composing) restoreDraft();
    },250);
  });
})();
