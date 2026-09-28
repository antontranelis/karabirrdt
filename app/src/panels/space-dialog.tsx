import type { Group, Item, RelationRecord } from "@real-life-stack/data-interface"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@real-life-stack/toolkit"
import { TraumPanel } from "./traum-panel"
import { DatenPanel } from "./daten-panel"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  brett: string
  group: Group | null
  items: Item[]
  relations: RelationRecord[]
}

/**
 * Was zum Space gehört und nicht zum Modul: der Traum und die Daten.
 *
 * Eigentlich gehörte beides in den `GroupDialog` des Toolkits — der hat aber
 * keinen Platz für zusätzliche Abschnitte, und der `WorkspaceSwitcher` keinen
 * für einen zweiten Menüpunkt (siehe docs/rls-kompatibel.md). Darum hier ein
 * zweiter Dialog neben dem Space-Menü, aus Toolkit-Bausteinen.
 */
export function SpaceDialog({ open, onOpenChange, brett, group, items, relations }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{group?.name || brett}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="traum">
          <TabsList>
            <TabsTrigger value="traum">Traum</TabsTrigger>
            <TabsTrigger value="daten">Daten</TabsTrigger>
          </TabsList>
          <TabsContent value="traum">
            <TraumPanel group={group} />
          </TabsContent>
          <TabsContent value="daten">
            <div className="max-h-[60vh] overflow-y-auto">
              <DatenPanel brett={brett} group={group} items={items} relations={relations} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
