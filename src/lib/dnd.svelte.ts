export interface DragInfo {
  id: string;
  listId: string;
  group: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface ListReg {
  group: string;
  drop: (fromId: string, fromListId: string, index: number) => void;
}

/** Shared drag state. One global pointerup listener performs the drop so listener order never matters. */
class DndState {
  active = $state<DragInfo | null>(null);
  hoverList = $state<string | null>(null);
  hoverIndex = $state<number | null>(null);
  x = $state(0);
  y = $state(0);
  private lists = new Map<string, ListReg>();
  private cleanup: (() => void) | null = null;

  register(listId: string, reg: ListReg): () => void {
    this.lists.set(listId, reg);
    return () => this.lists.delete(listId);
  }

  start(info: DragInfo): void {
    this.active = info;
    this.x = info.x;
    this.y = info.y;
    this.hoverList = null;
    this.hoverIndex = null;
    document.body.classList.add('is-dragging');
    const up = () => this.finish();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.end();
    };
    window.addEventListener('pointerup', up, { capture: true });
    window.addEventListener('pointercancel', up, { capture: true });
    window.addEventListener('keydown', key, { capture: true });
    this.cleanup = () => {
      window.removeEventListener('pointerup', up, { capture: true });
      window.removeEventListener('pointercancel', up, { capture: true });
      window.removeEventListener('keydown', key, { capture: true });
    };
  }

  move(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  hover(listId: string | null, index: number | null): void {
    this.hoverList = listId;
    this.hoverIndex = index;
  }

  private finish(): void {
    const active = this.active;
    const listId = this.hoverList;
    const index = this.hoverIndex;
    if (active && listId !== null && index !== null) {
      const reg = this.lists.get(listId);
      if (reg && reg.group === active.group) {
        try {
          reg.drop(active.id, active.listId, index);
        } catch (e) {
          console.error('drop failed', e);
        }
      }
    }
    this.end();
  }

  end(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.active = null;
    this.hoverList = null;
    this.hoverIndex = null;
    document.body.classList.remove('is-dragging');
  }
}

export const dnd = new DndState();
