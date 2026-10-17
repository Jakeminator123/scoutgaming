const messages: Record<string, string> = {
  studio_dealer_delete_pending: 'Dealerns permanenta radering har påbörjats men är inte klar. Välj Slutför radering. Dealern kan inte återställas.',
  studio_media_upload_grant_active: 'En tidigare uppladdningstillåtelse kan fortfarande användas. Filen behålls tills tillåtelsen har löpt ut.',
  studio_media_owned_elsewhere: 'Samma fil används av en annan arbetsyta eller miljö och behöver behållas.',
  studio_media_delete_failed: 'Lagringstjänsten kunde inte bekräfta raderingen. Filen är spärrad för återställning; välj Slutför radering för att försöka igen.',
  studio_media_already_deleted: 'Filen är redan permanent raderad. Uppdatera biblioteket.',
  studio_dealer_base_protected: 'Grunddealern ingår i den skyddade originalbanken.',
  studio_dealer_restore_conflict: 'Dealerns sparade klipp eller inställningar har ändrats. Återställningen stoppades för att bevara dina nuvarande val.',
  studio_dealer_archived: 'Dealern ligger i papperskorgen. Återställ den innan du ändrar klippen.',
  studio_dealer_published: 'Dealern finns i ett publicerat paket och behöver behållas. Se Publicering för bolagets presentationer.',
  studio_media_published: 'Klippet finns i ett publicerat paket och kan inte raderas.',
  studio_retained_media_immutable: 'Originalklippet ingår i den skyddade gemensamma banken.',
  studio_media_archive_required: 'Flytta klippet till papperskorgen innan du raderar det permanent.',
  studio_runtime_incompatible: 'Spelservern behöver uppdateras innan papperskorgen kan användas. Dina filer finns kvar.',
  studio_presentation_runtime_update_required: 'Spelservern behöver uppdateras innan papperskorgen kan användas. Dina filer och inställningar finns kvar.',
  studio_request_rejected: 'Du saknar behörighet eller sessionen har ändrats. Logga in igen och försök på nytt.',
  studio_login_required: 'Logga in igen innan du ändrar papperskorgen.',
  studio_conflict: 'Biblioteket eller projektet har ändrats. Uppdatera sidan och försök igen.',
  studio_media_in_use: 'Klippet används av sparade inställningar, historik eller ett publicerat paket. Det behöver finnas kvar.',
  studio_dealer_in_use: 'Dealern används av en presentation, ett spelrum eller ett publicerat paket. Byt dealer där först.',
  studio_dealer_speech_enabled: 'Stäng av dealerns AI-tal och spara innan du flyttar den till papperskorgen.',
  studio_dealer_not_registered: 'Återställ dealern innan du återställer ett enskilt klipp.',
  studio_media_deletion_pending: 'Permanent radering har påbörjats. Klippet kan inte återställas. Försök slutföra raderingen igen.',
  studio_media_delete_coverage_incomplete: 'Permanent radering är spärrad: servern kan ännu inte verifiera alla beroenden till lagringen. Filen finns kvar i papperskorgen.',
  studio_delete_coverage_incomplete: 'Permanent radering är spärrad: servern kan ännu inte verifiera alla beroenden till lagringen. Filen finns kvar i papperskorgen.',
  studio_media_retained: 'Det här originalklippet ingår i den skyddade gemensamma banken.',
  studio_media_not_archived: 'Flytta klippet till papperskorgen innan du raderar det permanent.',
};
export function mediaRemovalMessage(cause: unknown): string {
  const serverCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  const code = typeof serverCode === 'string' ? serverCode : typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : '';
  return messages[code] ?? 'Åtgärden kunde inte slutföras. Uppdatera sidan och försök igen. ' + (code.startsWith('studio_') ? `(${code})` : '');
}
