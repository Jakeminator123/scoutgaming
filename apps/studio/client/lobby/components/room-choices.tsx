"use client";
import { useLobby } from './lobby-provider';

/** Only appearance choices already published for this dealer in this room. */
export function RoomChoices() {
  const { dealer, choices, selectEnvironment, launchError } = useLobby();
  if (!dealer || !choices) return null;
  return <div className="mt-5 space-y-4">
    {dealer.independentLayers && ([['tableAsset', 'Bord', dealer.table], ['background', 'Bakgrund', dealer.background]] as const).map(([key, label, layer]) =>
      layer.enabled && layer.allowed.length > 0 ? <label key={key} className="block text-sm text-off">{label}
        <select aria-label={label} value={choices[key] ?? ''} onChange={event => selectEnvironment(key, event.target.value)}
          className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-off">
          {!layer.default && <option value="">Ingen vald</option>}
          {layer.allowed.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label> : null)}
    {launchError && <p role="alert" className="text-sm text-off">{launchError}</p>}
  </div>;
}
