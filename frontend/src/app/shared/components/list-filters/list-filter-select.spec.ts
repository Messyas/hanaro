import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListFilterSelect } from './list-filter-select';

describe('ListFilterSelect', () => {
  let component: ListFilterSelect;
  let fixture: ComponentFixture<ListFilterSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ListFilterSelect] }).compileComponents();
    fixture = TestBed.createComponent(ListFilterSelect);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', [
      { value: 'date', label: 'Data da transação' },
      { value: 'item', label: 'Código do item' },
    ]);
    fixture.componentRef.setInput('label', 'Ordenar por');
    fixture.detectChanges();
  });

  it('uses the Hanaro custom menu instead of a native select element', async () => {
    component.value.set('date');
    component.toggle(new Event('click'));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('select')).toBeNull();
    expect(element.querySelectorAll('.select-option')).toHaveLength(2);
    expect(element.querySelector('.select-trigger')?.textContent).toContain('Data da transação');
  });

  it('updates the model and emits the selected value', () => {
    let emitted = '';
    component.changed.subscribe((value) => (emitted = value));

    component.select('item');

    expect(component.value()).toBe('item');
    expect(emitted).toBe('item');
    expect(component.open()).toBe(false);
  });
});
