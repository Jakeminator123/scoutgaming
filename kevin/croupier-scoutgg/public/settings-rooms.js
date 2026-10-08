// Tester feedback (CH): the Room choices on the left took space from the table; they belong in
// Settings. The existing picker is moved as-is, so its click handling in app.js keeps working.
const pop=document.querySelector('.settings-popover'),rooms=document.querySelector('#studioRooms');
if(pop&&rooms){
  const nav=rooms.closest('nav');
  const heading=[...(nav?.querySelectorAll('h2')??[])].find(h=>h.textContent.trim()==='Room');
  const section=document.createElement('section');section.className='settings-rooms';
  const title=document.createElement('h4');title.textContent='Room';
  section.append(title,rooms);
  const note=document.querySelector('#studioNote');if(note)section.append(note);
  pop.querySelector('h3')?.after(section);
  heading?.remove();
}
