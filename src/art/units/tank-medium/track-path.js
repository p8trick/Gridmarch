// A taut belt around two raised end wheels and the first/last ground road wheels.
// Path direction: rear top -> front -> bottom -> rear. Coordinates are (z, y).
export function createTrackPath({roadZ,roadY,roadRadius,endZ,endY,endRadius,beltHalfThickness=.055}) {
  const r=roadRadius+beltHalfThickness,R=endRadius+beltHalfThickness;
  const dz=endZ-roadZ,dy=endY-roadY,d=Math.hypot(dz,dy);
  if(!(roadZ>0&&endZ>roadZ&&endY>roadY&&r>0&&R>0&&d>Math.abs(r-R)))throw new Error('Invalid track support wheel geometry');
  const alpha=Math.atan2(dy,dz)-Math.acos((r-R)/d);
  const rearAlpha=-Math.PI-alpha;
  const segments=[];
  const circlePoint=(z,y,radius,a)=>({z:z+radius*Math.cos(a),y:y+radius*Math.sin(a)});
  function line(a,b,name){const length=Math.hypot(b.z-a.z,b.y-a.y);segments.push({kind:'line',name,length,a,b,at(s){const t=s/length;return {z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t,dz:(b.z-a.z)/length,dy:(b.y-a.y)/length};}});}
  function arc(z,y,radius,start,end,name){const length=(start-end)*radius;segments.push({kind:'arc',name,length,z,y,radius,start,end,at(s){const a=start-s/radius;return {z:z+radius*Math.cos(a),y:y+radius*Math.sin(a),dz:Math.sin(a),dy:-Math.cos(a)};}});}
  line({z:-endZ,y:endY+R},{z:endZ,y:endY+R},'top');
  arc(endZ,endY,R,Math.PI/2,alpha,'front_wheel_wrap');
  line(circlePoint(endZ,endY,R,alpha),circlePoint(roadZ,roadY,r,alpha),'front_diagonal');
  arc(roadZ,roadY,r,alpha,-Math.PI/2,'front_road_transition');
  line({z:roadZ,y:roadY-r},{z:-roadZ,y:roadY-r},'bottom');
  arc(-roadZ,roadY,r,-Math.PI/2,rearAlpha,'rear_road_transition');
  line(circlePoint(-roadZ,roadY,r,rearAlpha),circlePoint(-endZ,endY,R,rearAlpha),'rear_diagonal');
  arc(-endZ,endY,R,rearAlpha,-3*Math.PI/2,'rear_wheel_wrap');
  const length=segments.reduce((sum,s)=>sum+s.length,0);
  function pointAt(distance){let t=((distance%length)+length)%length;for(const s of segments){if(t<=s.length)return s.at(t);t-=s.length;}return segments[0].at(0);}
  // Exact tangent boundaries are included; straight segments remain perfectly straight.
  const contour=[];for(const s of segments){const steps=s.kind==='arc'?Math.ceil((s.start-s.end)/(Math.PI/18)):1;for(let i=0;i<steps;i++)contour.push(s.at(s.length*i/steps));}
  return {length,pointAt,segments,contour};
}
