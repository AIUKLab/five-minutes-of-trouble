window.addEventListener('DOMContentLoaded', async function () {
  const invite = params();
  if (!invite.room || !invite.s || invite.p !== 2) return;
  const result = await sb.rpc('fm_state', {p_game:invite.room,p_secret:invite.s,p_player:2});
  if (result.error || !result.data || result.data.player2_name !== 'Player 2') return;
  stopPolling();
  $('#game').hidden=true;
  $('#paused').hidden=true;
  $('#join').hidden=false;
  $('#joinBtn').onclick=async function(){
    const chosen=$('#joinName').value.trim();
    if(!chosen){msg('You need a name before you cause trouble 😂');return;}
    const joined=await sb.rpc('fm_join_game',{p_game:invite.room,p_secret:invite.s,p_player:2,p_name:chosen});
    if(joined.error){msg('Run the small Supabase update first.');return;}
    $('#join').hidden=true;
    $('#game').hidden=false;
    await refresh();
    startPolling();
    msg('You’re in 😈');
  };
});
