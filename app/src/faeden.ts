import { useCallback } from "react"
import { hasRelationRecordWriter, type DataInterface, type RelationRecordWriterCapable } from "@real-life-stack/data-interface"
import { useConnector, useRelationRecords } from "@real-life-stack/toolkit"
import { FADEN_PRAEDIKAT } from "../../modell.mjs"

/**
 * Die Fäden des Bretts als RelationRecords (Prädikat `blocks`, von der
 * Voraussetzung zur abhängigen Karte). Kann ein Connector keine Records,
 * bleibt `schreibbar` falsch und die Oberfläche bietet das Fädenziehen
 * gar nicht erst an.
 */
export function useFaeden() {
  const connector = useConnector() as DataInterface
  const { data, supported } = useRelationRecords({ predicate: FADEN_PRAEDIKAT })
  const schreiber = hasRelationRecordWriter(connector) ? (connector as DataInterface & RelationRecordWriterCapable) : null

  const ziehe = useCallback(
    async (vonId: string, nachId: string) => {
      if (!schreiber) return
      await schreiber.createRelationRecord({ predicate: FADEN_PRAEDIKAT, from: `item:${vonId}`, to: `item:${nachId}` })
    },
    [schreiber],
  )
  const loese = useCallback(
    async (id: string) => {
      if (!schreiber) return
      await schreiber.deleteRelationRecord(id)
    },
    [schreiber],
  )

  return { faeden: data, lesbar: supported, schreibbar: !!schreiber, ziehe, loese }
}
