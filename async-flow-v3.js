(function(){
  let asyncMode=false;
  let openHistoryQuestion=null;
  let reactionsEnabled=false;
  let historyFilter='all';
  const reactionChoices=['❤️','😂','👀','🫶🏻','😈'];

  const oldRefresh=window.refresh;
  const oldNewQuestion=window.newQuestion;
  const oldSkip=window.skip;

  function partnerName(){return player===1?state?.player2_name:state?.player1_name;}

  function reactionFor(qid,answerPlayer,reactorPlayer){
    return (state?.reactions||[]).find(r=>r.question_id===qid && Number(r.answer_player)===Number(answerPlayer) && Number(r.reactor_player)===Number(reactorPlayer));
  }

  function reactionHtml(qid,answerPlayer){
    if(!reactionsEnabled) return '';
    const other=player===1?2:1;
    if(Number(answerPlayer)===Number(player)){
      const theirs=reactionFor(qid,answerPlayer,other);
      return theirs?`<div class="reactionNote">${esc(partnerName())} reacted ${esc(theirs.reaction)}</div>`:'';
    }
    const mine=reactionFor(qid,answerPlayer,player);
    return `<div class="reactionRow" aria-label="React to this answer">${reactionChoices.map(r=>`<button class="reactionBtn${mine?.reaction===r?' on':''}" data-qid="${qid}" data-answer-player="${answerPlayer}" data-reaction="${r}" type="button">${r}</button>`).join('')}</div>`;
  }

  async function loadReactions(){
    const result=await sb.rpc('fm_get_reactions',{p_game:game,p_secret:secret,p_player:player});
    if(result.error){reactionsEnabled=false;state.reactions=[];return;}
    reactionsEnabled=true;
    state.reactions=result.data||[];
  }

  async function refreshV3(){
    const active=document.activeElement;
    if(active && (active.id==='answer' || active.classList?.contains('historyAnswerInput'))) return;
    if(!game||!secret||!player) return;

    const {data,error}=await sb.rpc('fm_state_v2',{p_game:game,p_secret:secret,p_player:player});
    if(error){
      asyncMode=false;
      return oldRefresh();
    }
    asyncMode=true;
    state=data;
    await loadReactions();
    renderGameV3();
  }

  async function newQuestionV3(){
    if(!asyncMode) return oldNewQuestion();
    const q=pickQuestion();
    msg('Picking trouble…');
    const {error}=await sb.rpc('fm_new_question_v2',{
      p_game:game,
      p_secret:secret,
      p_player:player,
      p_category:selected,
      p_question:q
    });
    if(error){msg('Couldn’t pick a question.');return;}
    openHistoryQuestion=null;
    await refreshV3();
  }

  async function submitMainV3(){
    if(!asyncMode) return window.submitAnswerLegacy ? window.submitAnswerLegacy() : null;
    const cur=state?.current;
    if(!cur) return;
    const ans=$('#answer').value.trim();
    if(!ans){msg('You do actually have to type something 😂');return;}
    $('#submit').disabled=true;
    const {error}=await sb.rpc('fm_submit_answer',{p_game:game,p_secret:secret,p_question:cur.id,p_player:player,p_answer:ans});
    $('#submit').disabled=false;
    if(error){msg('That answer refused to cooperate.');return;}
    msg(cur.partner_submitted?'Both answers unlocked 👀':'Locked 🔒 Keep going whenever you like.');
    await refreshV3();
  }

  async function skipV3(){
    if(!asyncMode) return oldSkip();
    const cur=state?.current;
    if(!cur) return;
    const {error}=await sb.rpc('fm_skip_question_v2',{p_game:game,p_secret:secret,p_question:cur.id,p_player:player});
    if(error){msg('Can’t skip this one now — somebody has already answered it.');return;}
    msg('Skipped. No explanation required 😌');
    await refreshV3();
  }

  async function submitHistoryAnswer(qid){
    const input=document.querySelector(`.historyAnswerInput[data-qid="${qid}"]`);
    if(!input) return;
    const ans=input.value.trim();
    if(!ans){msg('You do actually have to type something 😂');return;}
    const {error}=await sb.rpc('fm_submit_answer',{p_game:game,p_secret:secret,p_question:qid,p_player:player,p_answer:ans});
    if(error){msg('That answer refused to cooperate.');return;}
    openHistoryQuestion=null;
    msg('Both answers unlocked 👀');
    await refreshV3();
  }

  async function setReaction(qid,answerPlayer,reaction){
    if(!reactionsEnabled) return;
    const {error}=await sb.rpc('fm_set_reaction',{
      p_game:game,
      p_secret:secret,
      p_question:qid,
      p_answer_player:Number(answerPlayer),
      p_reactor_player:player,
      p_reaction:reaction
    });
    if(error){msg('Reaction refused to cooperate 😅');return;}
    await refreshV3();
  }

  function playerAnswered(x,playerNo){
    return player===playerNo ? !!x.my_submitted : !!x.partner_submitted;
  }

  function historyFilterHtml(){
    const filters=[
      ['all','All'],
      ['both','Both'],
      ['p1',state.player1_name],
      ['p2',state.player2_name]
    ];
    return `<div class="cats" style="margin:12px 0 4px">${filters.map(([key,label])=>`<button type="button" class="cat historyFilterBtn${historyFilter===key?' on':''}" data-filter="${key}">${esc(label)}</button>`).join('')}</div>`;
  }

  function historyHtmlV3(){
    const allRows=(state?.history||[]).filter(x=>!x.skipped && (x.my_submitted||x.partner_submitted));
    if(!allRows.length) return '<p class="muted">Nothing revealed yet. Suspiciously innocent.</p>';

    const rows=allRows.filter(x=>{
      if(historyFilter==='both') return !!x.my_submitted && !!x.partner_submitted;
      if(historyFilter==='p1') return playerAnswered(x,1);
      if(historyFilter==='p2') return playerAnswered(x,2);
      return true;
    });

    const list=rows.length ? rows.map(x=>{
      const both=x.my_submitted&&x.partner_submitted;
      let body='';

      if(both){
        body=`<div class="answerBox"><strong>${esc(state.player1_name)}</strong><br>${esc(x.player1_answer)}${reactionHtml(x.id,1)}</div><div class="answerBox"><strong>${esc(state.player2_name)}</strong><br>${esc(x.player2_answer)}${reactionHtml(x.id,2)}</div>`;
      } else if(x.my_submitted){
        body=`<div class="answerBox"><strong>You</strong><br>${esc(x.my_answer)}</div><p class="muted">Waiting for ${esc(partnerName())} 🔒</p>`;
      } else if(x.partner_submitted){
        if(openHistoryQuestion===x.id){
          body=`<p class="muted">${esc(partnerName())} has already answered. Yours unlocks both 👀</p><textarea class="historyAnswerInput" data-qid="${x.id}" placeholder="Your answer…"></textarea><button class="primary historySubmit" data-qid="${x.id}" style="width:100%;margin-top:10px">Answer to reveal 👀</button>`;
        }else{
          body=`<p class="muted">${esc(partnerName())} has answered this 👀</p><button class="primary historyReveal" data-qid="${x.id}" style="width:100%">Answer to reveal 👀</button>`;
        }
      }

      return `<div class="historyItem"><div class="small">${esc(x.category)}</div><b>${esc(x.question)}</b>${body}</div>`;
    }).join('') : '<p class="muted">Nothing in this filter yet.</p>';

    return historyFilterHtml()+list;
  }

  function wireHistoryV3(){
    document.querySelectorAll('.historyFilterBtn').forEach(btn=>{
      btn.onclick=()=>{historyFilter=btn.dataset.filter;openHistoryQuestion=null;renderGameV3();};
    });
    document.querySelectorAll('.historyReveal').forEach(btn=>{
      btn.onclick=()=>{openHistoryQuestion=btn.dataset.qid;renderGameV3();};
    });
    document.querySelectorAll('.historySubmit').forEach(btn=>{
      btn.onclick=()=>submitHistoryAnswer(btn.dataset.qid);
    });
    document.querySelectorAll('.historyAnswerInput').forEach(input=>{
      input.addEventListener('focus',()=>{try{stopPolling();}catch(e){}});
      input.addEventListener('blur',()=>setTimeout(()=>{try{startPolling();}catch(e){}},500));
    });
    document.querySelectorAll('.reactionBtn').forEach(btn=>{
      btn.onclick=()=>setReaction(btn.dataset.qid,btn.dataset.answerPlayer,btn.dataset.reaction);
    });
  }

  function renderGameV3(){
    if(!asyncMode) return window.renderGameLegacy ? window.renderGameLegacy() : null;
    renderCats();
    $('#setup').hidden=true;
    $('#game').hidden=false;
    $('#paused').hidden=true;
    $('#who').textContent=`You’re ${player===1?state.player1_name:state.player2_name}`;
    $('#historyList').innerHTML=historyHtmlV3();
    wireHistoryV3();

    const cur=state.current;
    if(!cur){
      $('#question').textContent='Pick a category and cause a little trouble.';
      $('#category').textContent='READY WHEN YOU ARE';
      $('#answerArea').hidden=true;
      $('#reveal').hidden=true;
      $('#next').hidden=false;
      $('#skip').hidden=true;
      return;
    }

    $('#category').textContent=cur.category.toUpperCase();
    $('#question').textContent=cur.question;
    $('#reveal').hidden=true;
    $('#next').hidden=true;
    $('#answerArea').hidden=false;
    $('#answer').value='';
    $('#answer').disabled=false;
    $('#submit').hidden=false;
    $('#waiting').hidden=true;
    $('#skip').hidden=!!cur.partner_submitted;
  }

  window.submitAnswerLegacy=window.submitAnswer;
  window.renderGameLegacy=window.renderGame;
  window.refresh=refreshV3;
  window.newQuestion=newQuestionV3;
  window.submitAnswer=submitMainV3;
  window.skip=skipV3;
  window.renderGame=renderGameV3;
  window.historyHtml=historyHtmlV3;

  window.addEventListener('DOMContentLoaded',()=>{
    const next=$('#next'), submit=$('#submit'), skipBtn=$('#skip');
    if(next) next.onclick=newQuestionV3;
    if(submit) submit.onclick=submitMainV3;
    if(skipBtn) skipBtn.onclick=skipV3;
  });
})();
