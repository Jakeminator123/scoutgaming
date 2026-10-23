import {ADMIN_WORKSPACE_TOOLS} from '../../../../../packages/navigation/admin-workspace-routes.mjs';

export type AdminNavigationLink = {label:string;href:string;description:string};
export {adminNavigationGroups,adminSystemGroups} from '../../../../../packages/navigation/admin-navigation.mjs';
import {adminNavigationGroups,adminSystemGroups} from '../../../../../packages/navigation/admin-navigation.mjs';
// Contextual tools belong to their resource, never to a second tool directory.
export const adminToolHomes:Record<string,string>={
  companies:'/admin/companies',publication:'/admin/rooms',
  'dealer-studio':'/admin/clips','dealer-agent':'/admin/clips',
  'media-review':'/admin/clips',replies:'/admin/clips',events:'/admin/clips',guide:'/admin/guide',
};
export const adminToolHome=(tool:string|null)=>tool?adminToolHomes[tool]??'/admin':null;
export const adminPageLabels:Record<string,string> = {
  ...Object.fromEntries(Object.entries(ADMIN_WORKSPACE_TOOLS).map(([key,label])=>['/admin/'+key,label])),
  ...Object.fromEntries([...adminNavigationGroups,...adminSystemGroups].flatMap(group=>group.links.map(link=>[link.href,link.label]))),
  '/admin':'Översikt','/admin/admin/operators':'Spelbolag','/admin/admin/players':'Spelarkonton',
};
