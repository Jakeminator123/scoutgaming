import {ConnectedServices,type AccountsSection} from './connected-services';

export type AccountsRoute={path:string;label:string;area:'Verksamhet'|'System';description:string;section:AccountsSection};
/** Players (nivå 3): balances, status, Hantera konto and Skapa spelarkonto. */
export const PLAYER_ACCOUNTS_ROUTE:AccountsRoute=Object.freeze({path:'/admin/players',label:'Spelarkonton',area:'Verksamhet',description:'Spelarnas saldo och status. Skapa eller hantera spelarkonton för lobbyn och spelen.',section:'players'});
/** Admin staff (nivå 1): Användare och roller with invitations. */
export const ADMIN_STAFF_ROUTE:AccountsRoute=Object.freeze({path:'/admin/admin/accounts',label:'Konton & åtkomst',area:'System',description:'Adminpersonalens konton, roller och inbjudningar till nivå 1.',section:'users'});

// Each page reads and shows only its own part of the accounts group through the
// native reader. The link leads to the other half so nothing is lost.
function AccountsPage({route,other}:{route:AccountsRoute;other:AccountsRoute}) {
  return <div className="admin-system-page admin-accounts-page">
    <header className="admin-system-header"><div><p className="sg-eyebrow">{route.area}</p><h1 id={route.section+'-accounts-title'}>{route.label}</h1><p>{route.description}</p></div>
      <nav className="admin-system-actions" aria-label="Fler konton"><a className="studio-button" href={other.path}>{other.label}</a></nav></header>
    <ConnectedServices path={ADMIN_STAFF_ROUTE.path} section={route.section}/>
  </div>;
}
export function PlayerAccountsPage(){return <AccountsPage route={PLAYER_ACCOUNTS_ROUTE} other={ADMIN_STAFF_ROUTE}/>;}
export function AdminStaffPage(){return <AccountsPage route={ADMIN_STAFF_ROUTE} other={PLAYER_ACCOUNTS_ROUTE}/>;}
