/**
 * Vertical document scroll speed in pixels per animation frame while dragging.
 * A held pointer near either viewport edge scrolls toward off-screen calendar hours.
 * Returns zero in the middle so a stationary drag stays stationary.
 */
export function edgeScrollSpeed(pointerY:number,viewportHeight:number,viewportTop=0):number{
  if(!Number.isFinite(pointerY)||!Number.isFinite(viewportHeight)||viewportHeight<=0)return 0;
  const edge=Math.max(55,Math.min(125,viewportHeight*0.19));
  const topDistance=pointerY-viewportTop;
  const bottomDistance=viewportTop+viewportHeight-pointerY;
  if(topDistance<edge){
    const intensity=Math.max(0,Math.min(1,(edge-topDistance)/edge));
    return -Math.max(1,Math.round(27*intensity*intensity));
  }
  if(bottomDistance<edge){
    const intensity=Math.max(0,Math.min(1,(edge-bottomDistance)/edge));
    return Math.max(1,Math.round(27*intensity*intensity));
  }
  return 0;
}
