import {analyze, type Lane, type Workspace} from './analysis';
export type PlanItem={id:string;title:string;description:string;lane:Lane;signalIds:string[]};
export type Plan={createdAt:string;items:PlanItem[]};
export function savedPlan(workspace:Workspace):PlanItem[]{
 return workspace.plan?.items || (workspace.roadmapItems||[]).map(item=>({...item,signalIds:[]}));
}
export function buildSuggestions(workspace:Workspace):PlanItem[]{
 const previous=savedPlan(workspace), assigned=new Set<string>();
 const themes=analyze({...workspace,hidden:[]}).filter(t=>!t.manual).sort((a,b)=>b.signalIds.length-a.signalIds.length||b.score-a.score);
 const suggestions:PlanItem[]=[];
 for(const theme of themes){
  const signalIds=theme.signalIds.filter(id=>!assigned.has(id));
  if(!signalIds.length)continue;
  signalIds.forEach(id=>assigned.add(id));
  const old=previous.find(item=>item.id===theme.id);
  suggestions.push({id:theme.id,title:old?.title||theme.initiative,description:old?.description||`Proposed improvement for ${theme.name.toLowerCase()}. Confirm the desired outcome with the people who reported it.`,lane:old?.lane||theme.lane,signalIds});
 }
 // Retain previously saved or manually created work when generating suggestions again.
 for(const item of previous)if(!suggestions.some(next=>next.id===item.id))suggestions.push(item);
 return suggestions;
}
export function exportPlan(items:PlanItem[],workspace:Workspace):string{
 return ['# NextSignal roadmap','','Draft priorities for review. Lane order does not imply committed dates.','',...(['Now','Next','Later'] as Lane[]).flatMap(lane=>[`## ${lane}`,'',...items.filter(item=>item.lane===lane).flatMap(item=>[`### ${item.title}`,item.description,'',...item.signalIds.flatMap(id=>{const signal=workspace.signals.find(x=>x.id===id);return signal?[`- Evidence: ${signal.text}`]:[];}),''])])].join('\n');
}
