import type { User } from "@real-life-stack/data-interface"
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@real-life-stack/toolkit"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mitglieder: readonly User[]
  ich: User | null
  onWahl: (userId: string | null) => void
}

/**
 * „Wer bist du an diesem Brett?" — die App kennt keine Anmeldung. Die
 * Selbstaktionen im Detail („Kann ich", „Will lernen") schreiben die hier
 * gewählte Person; ohne Wahl ist es der Tisch. Gemerkt wird die Wahl im
 * Browser, je Brett (Lücke: kein Baustein für eine Identität ohne Konto,
 * docs/rls-kompatibel.md).
 */
export function IchDialog({ open, onOpenChange, mitglieder, ich, onWahl }: Props) {
  const waehle = (id: string | null) => {
    onWahl(id)
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Wer bist du?</DialogTitle>
          <DialogDescription>„Kann ich" und „Will lernen" tragen dich an diesem Brett ein.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {mitglieder.map((m) => (
            <Button key={m.id} variant={ich?.id === m.id ? "secondary" : "ghost"} className="justify-start" onClick={() => waehle(m.id)}>
              {m.displayName || m.id}
            </Button>
          ))}
          <Button variant="ghost" className="justify-start text-muted-foreground" onClick={() => waehle(null)}>
            Niemand, nur am Tisch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
