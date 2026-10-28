export type AdminNavigationLink = {label:string;href:string;description:string};
export type AdminTab = {id:string;label:string};
export {adminNavigationGroups,adminMenuLinks,adminDealerTabs,adminDealerSteps,adminSceneTabs,adminCompanyListTabs,adminCompanyTabs,adminRoomTabs,adminSystemTabs,adminTabId} from '../../../../../packages/navigation/admin-navigation.mjs';
import {adminMenuLinks} from '../../../../../packages/navigation/admin-navigation.mjs';
export const adminPageLabels:Record<string,string> = {
  ...Object.fromEntries(adminMenuLinks.map(link=>[link.href,link.label])),
  '/admin':'Översikt',
};
