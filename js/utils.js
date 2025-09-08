// Otsu
export function otsu(gray){
  const hist = new Float32Array(256);
  for (const v of gray){ hist[Math.min(255, Math.max(0, (v*255)|0))]++; }
  const total = gray.length;
  let sum=0; for (let i=0;i<256;i++) sum += i*hist[i];
  let sumB=0, wB=0, varMax=-1, th=0;
  for (let i=0;i<256;i++){
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i*hist[i];
    const mB = sumB/wB, mF = (sum - sumB)/wF;
    const between = wB*wF*(mB - mF)*(mB - mF);
    if (between > varMax){ varMax = between; th = i; }
  }
  return th/255;
}

// 最大连通域（4邻接）
export function largestCC(bin, w, h){
  const visited = new Uint8Array(w*h);
  let best=null, bestSize=0;
  const qx=new Int32Array(w*h), qy=new Int32Array(w*h);
  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      const idx=y*w+x;
      if (bin[idx]===0 || visited[idx]) continue;
      let head=0, tail=0;
      qx[tail]=x; qy[tail]=y; tail++;
      visited[idx]=1;
      let minx=x, maxx=x, miny=y, maxy=y, size=0;
      while(head<tail){
        const cx=qx[head], cy=qy[head]; head++;
        size++;
        if (cx<minx) minx=cx; if (cx>maxx) maxx=cx;
        if (cy<miny) miny=cy; if (cy>maxy) maxy=cy;
        const nbs = [[1,0],[-1,0],[0,1],[0,-1]];
        for (const [dx,dy] of nbs){
          const nx=cx+dx, ny=cy+dy;
          if (nx<0||nx>=w||ny<0||ny>=h) continue;
          const nidx=ny*w+nx;
          if (!visited[nidx] && bin[nidx]===1){
            visited[nidx]=1; qx[tail]=nx; qy[tail]=ny; tail++;
          }
        }
      }
      if (size>bestSize){ bestSize=size; best={x0:minx,y0:miny,x1:maxx,y1:maxy}; }
    }
  }
  return best;
}

// 质心
export function computeCentroid(img, w, h){
  let sum=0, sx=0, sy=0;
  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      const v = img[y*w+x];
      sum += v; sx += v*x; sy += v*y;
    }
  }
  if (sum<=0) return { cx: w/2, cy: h/2, mass:0 };
  return { cx: sx/sum, cy: sy/sum, mass: sum };
}

// 简单高斯模糊（分离1D）
export function gaussianBlur1D(img, w, h, sigma=0.8, vertical=false){
  const radius = Math.max(1, Math.round(sigma*2.5));
  const k = new Float32Array(radius*2+1);
  let s=0;
  for (let i=-radius;i<=radius;i++){
    const val = Math.exp(-(i*i)/(2*sigma*sigma));
    k[i+radius] = val; s+=val;
  }
  for (let i=0;i<k.length;i++) k[i]/=s;

  const out = new Float32Array(w*h);
  if (!vertical) {
    for (let y=0;y<h;y++){
      for (let x=0;x<w;x++){
        let acc=0;
        for (let t=-radius;t<=radius;t++){
          const xx = Math.min(w-1, Math.max(0, x+t));
          acc += img[y*w+xx]*k[t+radius];
        }
        out[y*w+x]=acc;
      }
    }
    img.set(out);
  } else {
    for (let x=0;x<w;x++){
      for (let y=0;y<h;y++){
        let acc=0;
        for (let t=-radius;t<=radius;t++){
          const yy = Math.min(h-1, Math.max(0, y+t));
          acc += img[yy*w+x]*k[t+radius];
        }
        out[y*w+x]=acc;
      }
    }
    img.set(out);
  }
}

// 概率工具
export function softmax(arr){
  const m = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - m));
  const s = exps.reduce((a,b)=>a+b,0);
  return exps.map(v => v/s);
}
export function argTopK(probs, k){
  return probs.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p).slice(0,k);
}

// 概率条渲染
export function renderBars(root, probs, highlightIdx){
  root.innerHTML='';
  for (let i=0;i<10;i++){
    const bar = document.createElement('div'); bar.className='bar';
    const span = document.createElement('span');
    span.style.width = (probs[i]*100).toFixed(2)+'%';
    if (i===highlightIdx) span.style.filter='brightness(1.35)';
    const label = document.createElement('label'); label.textContent = String(i);
    const val = document.createElement('em'); val.textContent = (probs[i]*100).toFixed(2)+'%';
    bar.append(span,label,val); root.appendChild(bar);
  }
}