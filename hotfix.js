(function(){
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

  function run(){fixAnswerBox();removeNamedInvitePrompt();}
  window.addEventListener('DOMContentLoaded',()=>{
    run();
    const observer=new MutationObserver(run);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
    setInterval(run,750);
    document.addEventListener('touchstart',e=>{
      if(e.target && e.target.id==='answer') fixAnswerBox();
    },{passive:true});
  });
})();
