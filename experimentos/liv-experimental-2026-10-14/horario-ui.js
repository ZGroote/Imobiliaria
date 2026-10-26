import {formatHour,solarState} from './horario-solar.js';

export function createTimeControl(stage,onInput) {
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./horario-ui.css',import.meta.url).href;
  document.head.append(stylesheet);
  const element=document.createElement('div');element.className='liv-clock';
  element.innerHTML=`<div class="liv-clock-heading"><label for="livHour">Horário do sol</label><output for="livHour" id="livHourValue"></output></div>
    <div class="liv-clock-scale"><input id="livHour" type="range" min="0" max="24" step="0.05" aria-orientation="vertical" aria-describedby="livHourNote">
    <div class="liv-clock-ticks" aria-hidden="true"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div></div>
    <p id="livHourNote"><span class="liv-clock-phase"></span><span class="liv-clock-detail">Luz ilustrativa</span></p>`;
  stage.append(element);
  const input=element.querySelector('input'),output=element.querySelector('output'),phase=element.querySelector('.liv-clock-phase');
  input.addEventListener('input',()=>onInput(Number(input.value)));
  return {
    update({hour,date,ready,visible=true}) {
      const solar=solarState(hour,{date}),time=formatHour(hour);
      element.dataset.phase=solar.phase;
      element.hidden=!visible;input.disabled=!ready;input.value=String(hour);output.value=time;
      phase.textContent={dia:'Dia',noite:'Noite · luzes acesas',amanhecer:'Amanhecer',anoitecer:'Anoitecer · luzes acendendo'}[solar.phase];
      input.setAttribute('aria-valuetext',`${time}, ${phase.textContent.toLowerCase()}`);
      element.title=`${date.split('-').reverse().join('/')} · posição solar pela localização e implantação aproximada do LIV`;
    },
    dispose(){element.remove();stylesheet.remove();},
  };
}
