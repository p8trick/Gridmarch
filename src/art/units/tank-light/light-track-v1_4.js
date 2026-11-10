// A taut belt around two raised end wheels and the first/last ground road wheels.
// Path direction: rear top -> front -> bottom -> rear. Coordinates are (z, y).
export function createTrackPath({roadZ,roadY,roadRadius,endZ,endY,endRadius,beltHalfThickness=.055,topSag=0,returnZ=.5866666667,returnY=.535,returnRadius=.078}) {
  const r=roadRadius+beltHalfThickness,R=endRadius+beltHalfThickness;
  const dz=endZ-roadZ,dy=endY-roadY,distance=Math.hypot(dz,dy);
  if(!(roadZ>0&&endZ>roadZ&&endY>roadY&&r>0&&R>0&&distance>Math.abs(r-R)))throw new Error('Invalid track support wheel geometry');
  const alpha=Math.atan2(dy,dz)-Math.acos((r-R)/distance);
  const rearAlpha=-Math.PI-alpha;
  const segments=[];
  const circlePoint=(z,y,radius,a)=>({z:z+radius*Math.cos(a),y:y+radius*Math.sin(a)});
  function line(a,b,name){const length=Math.hypot(b.z-a.z,b.y-a.y);segments.push({kind:'line',name,length,a,b,at(s){const t=s/length;return {z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t,dz:(b.z-a.z)/length,dy:(b.y-a.y)/length};}});}
  function arc(z,y,radius,start,end,name){
    const direction=Math.sign(end-start),length=Math.abs(end-start)*radius;
    segments.push({kind:'arc',name,length,z,y,radius,start,end,at(s){const a=start+direction*s/radius;return {z:z+radius*Math.cos(a),y:y+radius*Math.sin(a),dz:-direction*Math.sin(a),dy:direction*Math.cos(a)};}});
  }
  // The upper run is supported by the return rollers, not an independent sag curve.
  const rr=returnRadius+beltHalfThickness,dx=endZ-returnZ,dyTop=returnY-endY;
  const topAngle=Math.atan2(dyTop,dx)+Math.acos((R-rr)/Math.hypot(dx,dyTop));
  const frontAngle=Math.PI-topAngle;
  function blend(a,b,c,d,name){
    const point=t=>({z:(1-t)**3*a.z+3*(1-t)**2*t*b.z+3*(1-t)*t*t*c.z+t**3*d.z,y:(1-t)**3*a.y+3*(1-t)**2*t*b.y+3*(1-t)*t*t*c.y+t**3*d.y});
    const table=[0];let last=a;for(let i=1;i<=200;i++){const q=point(i/200);table.push(table[i-1]+Math.hypot(q.z-last.z,q.y-last.y));last=q;}
    const length=table[200];segments.push({kind:'blend',name,length,at(s){let i=1;while(i<200&&table[i]<s)i++;const t=(i-1+(s-table[i-1])/(table[i]-table[i-1]))/200,q=point(t);
      const dz=3*(1-t)**2*(b.z-a.z)+6*(1-t)*t*(c.z-b.z)+3*t*t*(d.z-c.z),dy=3*(1-t)**2*(b.y-a.y)+6*(1-t)*t*(c.y-b.y)+3*t*t*(d.y-c.y),n=Math.hypot(dz,dy);return {...q,dz:dz/n,dy:dy/n};}});
  }
  // A short free-span bend approaches the roller crowns without cutting through them.
  const a=circlePoint(-endZ,endY,R,topAngle),d={z:-returnZ,y:returnY+rr};
  const b={z:a.z+.23*Math.sin(topAngle),y:a.y-.23*Math.cos(topAngle)},c={z:d.z-.18,y:d.y};
  blend(a,b,c,d,'top_rear_slope');
  line(d,{z:returnZ,y:returnY+rr},'top_center');
  const mirror=q=>({z:-q.z,y:q.y});blend(mirror(d),mirror(c),mirror(b),mirror(a),'top_front_slope');
  arc(endZ,endY,R,frontAngle,alpha,'front_wheel_wrap');
  line(circlePoint(endZ,endY,R,alpha),circlePoint(roadZ,roadY,r,alpha),'front_diagonal');
  arc(roadZ,roadY,r,alpha,-Math.PI/2,'front_road_transition');
  line({z:roadZ,y:roadY-r},{z:-roadZ,y:roadY-r},'bottom');
  arc(-roadZ,roadY,r,-Math.PI/2,rearAlpha,'rear_road_transition');
  line(circlePoint(-roadZ,roadY,r,rearAlpha),circlePoint(-endZ,endY,R,rearAlpha),'rear_diagonal');
  arc(-endZ,endY,R,rearAlpha,topAngle-2*Math.PI,'rear_wheel_wrap');
  const length=segments.reduce((sum,s)=>sum+s.length,0);
  function pointAt(distance){let t=((distance%length)+length)%length;for(const s of segments){if(t<=s.length)return s.at(t);t-=s.length;}return segments[0].at(0);}
  // Exact tangent boundaries are included; straight segments remain perfectly straight.
  const contour=[];for(const s of segments){const steps=s.kind==='arc'?Math.ceil(Math.abs(s.start-s.end)/(Math.PI/18)):s.kind==='blend'?24:1;for(let i=0;i<steps;i++)contour.push(s.at(s.length*i/steps));}
  return {length,pointAt,segments,contour};
}
