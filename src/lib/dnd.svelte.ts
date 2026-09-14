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

class DndState {
  active = $state<DragInfo | null>(null);
  hoverList = $state<string | null>(null);
  x = $state(0);
  y = $state(0);

  start(info: DragInfo): void {
    this.active = info;
    this.x = info.x;
    this.y = info.y;
    document.body.classList.add('is-dragging');
  }
  move(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  end(): void {
    this.active = null;
    this.hoverList = null;
    document.body.classList.remove('is-dragging');
  }
}

export const dnd = new DndState();
