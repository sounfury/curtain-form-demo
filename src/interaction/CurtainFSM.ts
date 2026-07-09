export type CurtainState = 'IDLE' | 'DRAGGING';

export type StateTransition = {
  from: CurtainState;
  to: CurtainState;
  reason: string;
};

export class CurtainFSM {
  private _state: CurtainState = 'IDLE';
  private listeners: ((transition: StateTransition) => void)[] = [];

  get state(): CurtainState {
    return this._state;
  }

  onTransition(listener: (transition: StateTransition) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((entry) => entry !== listener);
    };
  }

  /** 开始拖拽 */
  startDragging(): boolean {
    if (this._state === 'IDLE') {
      this.transition('IDLE', 'DRAGGING', 'pointerdown');
      return true;
    }
    return false;
  }

  /** 释放并回弹到 IDLE */
  release(): void {
    if (this._state === 'DRAGGING') {
      this.transition('DRAGGING', 'IDLE', 'pointerup-springback');
    }
  }

  private transition(from: CurtainState, to: CurtainState, reason: string): void {
    this._state = to;
    const transition: StateTransition = { from, to, reason };
    for (const listener of this.listeners) {
      listener(transition);
    }
  }
}
