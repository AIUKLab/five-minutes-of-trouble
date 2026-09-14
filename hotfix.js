(function(){
  let typing=false;
  let resumeTimer=null;

  function fixAnswerBox(){
    const answer=document.getElementById('answer');
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
    const answer=document.getElementById('answer');
    if(!answer || answer.dataset.typingFix==='1') return;
    answer.dataset.typingFix='1';
    answer.addEventListener('focus',suspendPolling);
    answer.addEventListener('input',suspendPolling);
    answer.addEventListener('blur',resumePollingSoon);
  }

  function run(){
    fixAnswerBox();
    removeNamedInvitePrompt();
    wireAnswerBox();
  }

  window.addEventListener('DOMContentLoaded',()=>{
    run();
    const observer=new MutationObserver(()=>{
      if(!typing) run();
      else wireAnswerBox();
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
    setInterval(()=>{ if(!typing) run(); },750);
    document.addEventListener('touchstart',e=>{
      if(e.target && e.target.id==='answer'){
        suspendPolling();
        fixAnswerBox();
      }
    },{passive:true});
  });
})();
