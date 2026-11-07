export function memberListPanel(model,{esc,field}) {
  const members=model.members||[];
  return `<p>${members.length} Vereinsmitglieder · Rolle: Vereinsmitglied</p>
  <form data-save="member-add">${field('email','E-Mail-Adresse','','email','required maxlength="254"')}<button>Mitglied hinzufügen</button></form>
  <div class="member-list">${members.map(m=>`<form data-save="member-remove"><div class="member-address">${esc(m.email)}<small>Vereinsmitglied</small></div><input type="hidden" name="email" value="${esc(m.email)}"><button>Zugang widerrufen</button></form>`).join('')||'<p>Noch keine Vereinsmitglieder freigegeben.</p>'}</div>`;
}
