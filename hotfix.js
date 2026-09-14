(function(){
  let typing=false;
  let resumeTimer=null;

  function answerEl(){return document.getElementById('answer');}

  function fixAnswerBox(){
    const answer=answerEl();
    const answerArea=document.getElementById('answerArea');
    const submit=document.getElementById('submit');
    const reveal=document.getElementById('reveal');
    if(!answer||!answerArea) return;
    const canEdit=!answerArea.hidden && (!reveal || reveal.hidden) && (!submit || !submit.hidden);
    if(canEdit){
      answer.disabled=false;
      answer.readOnly=false;
      answer.removeAttribute('disabled');
      answer.removeAttribute('readonly');
      answer.style.pointerEvents='auto';
      answer.style.webkitUserSelect='text';
      answer.style.userSelect='text';
      answer.style.touchAction='manipulation';
    }
  }

  function removeNamedInvitePrompt(){
    const nodes=[document.getElementById('toast'),document.getElementById('who')].filter(Boolean);
    nodes.forEach(el=>{
      if(/send\s+vee\s+an\s+invite/i.test(el.textContent||'')) el.textContent='';
    });
  }

  function suspendPolling(){
    typing=true;
    if(resumeTimer) clearTimeout(resumeTimer);
    try{ if(typeof stopPolling==='function') stopPolling(); }catch(e){}
  }

  function resumePollingSoon(){
    typing=false;
    if(resumeTimer) clearTimeout(resumeTimer);
    resumeTimer=setTimeout(()=>{
      try{ if(typeof startPolling==='function') startPolling(); }catch(e){}
    },1200);
  }

  function wireAnswerBox(){
    const answer=answerEl();
    if(!answer || answer.dataset.typingFix==='1') return;
    answer.dataset.typingFix='1';
    answer.addEventListener('focus',suspendPolling);
    answer.addEventListener('input',suspendPolling);
    answer.addEventListener('blur',resumePollingSoon);
  }

  /* A refresh may already be in flight when the keyboard opens. app.js then
     renders the unanswered question and assigns answer.value='', which makes
     iOS predictive/composition text appear to jumble. Preserve the draft and
     caret across any such render while the textarea is focused. */
  try{
    if(typeof renderGame==='function'){
      const originalRenderGame=renderGame;
      renderGame=function(){
        const before=answerEl();
        const focused=before && document.activeElement===before;
        const draft=focused ? before.value : null;
        const start=focused ? before.selectionStart : null;
        const end=focused ? before.selectionEnd : null;
        originalRenderGame();
        const after=answerEl();
        if(focused && after && !after.disabled){
          after.value=draft;
          try{after.focus({preventScroll:true});}catch(e){after.focus();}
          try{after.setSelectionRange(start,end);}catch(e){}
        }
      };
    }
  }catch(e){}

  function run(){fixAnswerBox();removeNamedInvitePrompt();wireAnswerBox();}

  window.addEventListener('DOMContentLoaded',()=>{
    run();
    const observer=new MutationObserver(()=>{if(!typing) run();});
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
    setInterval(()=>{if(!typing) run();},750);
    document.addEventListener('touchstart',e=>{
      if(e.target && e.target.id==='answer'){
        suspendPolling();
        fixAnswerBox();
      }
    },{passive:true});
  });
})();
