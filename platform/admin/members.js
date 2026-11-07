export function membersPanel(model,{esc,field}) {
  const kinds={news:'Interne Nachrichten',documents:'Dokumente',events:'Interne Veranstaltungen'};
  return `<h3>Vereinsmitglieder</h3><p>Freigabe über die eingetragene E-Mail-Adresse, ohne Bestätigungscode. Vereinsmitglieder erhalten keine Verwaltungsrechte. Es werden keine E-Mails versendet.</p>
  <form data-save="member-add">${field('email','E-Mail-Adresse','','email','required maxlength="254"')}<p>Rolle: Vereinsmitglied</p><button>Mitglied hinzufügen</button></form>
  ${(model.members||[]).map(m=>`<form data-save="member-remove">${field('email','Vereinsmitglied',m.email,'email','readonly required')}<button>Zugang widerrufen</button></form>`).join('')||'<p>Noch keine Vereinsmitglieder freigegeben.</p>'}
  <h3>Inhalte nur für Mitglieder</h3><p>Nachrichten, Textdokumente und Veranstaltungsinformationen werden ausschließlich im Mitgliederbereich angezeigt.</p>
  <form data-save="member-content"><label>Kategorie<select name="kind">${Object.entries(kinds).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>${field('title','Titel','','text','required maxlength="200"')}<label>Text<textarea name="body" required maxlength="20000"></textarea></label><button>Für Mitglieder veröffentlichen</button></form>
  ${(model.memberContent||[]).map(c=>`<details><summary>${esc(kinds[c.kind])}: ${esc(c.title)}</summary><form data-save="member-content" data-id="${esc(c.id)}"><input type="hidden" name="kind" value="${esc(c.kind)}">${field('title','Titel',c.title,'text','required maxlength="200"')}<label>Text<textarea name="body" required maxlength="20000">${esc(c.body)}</textarea></label><button>Änderungen speichern</button><button name="remove" value="1">Inhalt entfernen</button></form></details>`).join('')}
  <h3>Verwaltungszugänge</h3>`;
}
