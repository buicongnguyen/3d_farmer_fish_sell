// The jump, ported from Zoo Garden (cute_game src/jump-rules.ts): a height only. Where you may stand is decided by the usual
// movement and its walls, so a jump never clears a fence or a pond. world.mjs adds `jump.height` to the player's feet.
// A tap jumps; a tap just before landing jumps on touch-down; holding the button or Space does the extra jumps at the top of each arc.
export const JUMP={gravity:70,rise:[2,1.3,1.1],maxJumps:3,landLag:.12,buffer:.12,fallMax:26,flourish:.28};
/** Take-off speed (m/s) of jump n (1 to 3): each adds its own height from wherever it starts. */
export const jumpSpeed=n=>Math.sqrt(2*JUMP.gravity*JUMP.rise[Math.max(0,Math.min(JUMP.maxJumps,n)-1)]);
export class JumpState{
 height=0;velocity=0;jumps=0;lag=0;spin=0;max=JUMP.maxJumps;
 get airborne(){return this.jumps>0;}
 get ready(){return this.jumps===0?this.lag<=0:this.jumps<Math.min(JUMP.maxJumps,this.max);}
 /** Jumps; returns which jump it was (1 to 3) or 0 when none is left or the landing lag still runs. */
 jump(){if(!this.ready)return 0;this.jumps++;this.velocity=jumpSpeed(this.jumps);if(this.jumps>1)this.spin=JUMP.flourish;return this.jumps;}
 /** One step of the arc; true on the step you touch down. */
 step(dt){if(!(dt>0))return false;this.spin=Math.max(0,this.spin-dt);if(!this.airborne){this.lag=Math.max(0,this.lag-dt);return false;}
  this.velocity=Math.max(-JUMP.fallMax,this.velocity-JUMP.gravity*dt);this.height+=this.velocity*dt;if(this.height>0)return false;this.lag=JUMP.landLag;this.reset();return true;}
 cancel(){this.reset();this.lag=0;}
 reset(){this.height=0;this.velocity=0;this.jumps=0;this.spin=0;}
}
export class JumpInput{
 held=false;buffer=0;
 down(){this.held=true;this.buffer=JUMP.buffer;}up(){this.held=false;}clear(){this.held=false;this.buffer=0;}
 /** Call every step: true when a jump should be tried now. */
 wants(state,dt){if(this.buffer>0){if(state.airborne||state.lag<=0)this.buffer=Math.max(0,this.buffer-dt);return true;}
  return this.held&&state.airborne&&state.velocity<=0&&state.jumps<Math.min(JUMP.maxJumps,state.max);}
 done(){this.buffer=0;}
}
