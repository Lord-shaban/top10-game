/**
 * تطبيع النص العربي - إزالة التشكيل وتوحيد الأحرف المتشابهة
 */
function normalizeArabic(text) {
  return text
    .toLowerCase()
    // إزالة التشكيل (الفتحة، الضمة، الكسرة، السكون، الشدة، التنوين)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '')
    // توحيد الهمزات: أ إ آ ء ؤ ئ → ا
    .replace(/[أإآءؤئ]/g, 'ا')
    // توحيد التاء المربوطة: ة → ه
    .replace(/ة/g, 'ه')
    // توحيد الألف المقصورة: ى → ي
    .replace(/ى/g, 'ي')
    // إزالة المسافات الزائدة
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Autocomplete — نظام الإكمال التلقائي
 */
class Autocomplete {
  /**
   * @param {HTMLInputElement} input - حقل الإدخال
   * @param {HTMLElement} listEl - حاوية الاقتراحات
   * @param {Function} onSelect - دالة عند اختيار اقتراح
   */
  constructor(input, listEl, onSelect) {
    this.input = input;
    this.listEl = listEl;
    this.onSelect = onSelect;
    this.suggestions = [];
    this.filtered = [];
    this.activeIndex = -1;
    this.isOpen = false;

    this._bindEvents();
  }

  /**
   * تحديث قائمة الاقتراحات
   */
  setSuggestions(suggestions) {
    this.suggestions = suggestions || [];
  }

  /**
   * ربط الأحداث
   */
  _bindEvents() {
    this.input.addEventListener('input', () => this._onInput());
    this.input.addEventListener('keydown', (e) => this._onKeyDown(e));
    this.input.addEventListener('focus', () => {
      if (this.input.value.trim().length > 0) {
        this._onInput();
      }
    });

    // إغلاق عند النقر خارج القائمة
    document.addEventListener('click', (e) => {
      if (!this.input.contains(e.target) && !this.listEl.contains(e.target)) {
        this._close();
      }
    });
  }

  /**
   * عند الكتابة في حقل الإدخال
   */
  _onInput() {
    const rawQuery = this.input.value.trim();
    
    if (rawQuery.length === 0) {
      this._close();
      return;
    }

    const query = normalizeArabic(rawQuery);

    // فلترة الاقتراحات مع تطبيع النص العربي
    this.filtered = this.suggestions.filter(item => {
      const allNames = [item.name, ...(item.aliases || [])];
      return allNames.some(name => normalizeArabic(name).includes(query));
    });

    if (this.filtered.length === 0) {
      this._close();
      return;
    }

    this.activeIndex = -1;
    this._render(query);
    this._open();
  }

  /**
   * التعامل مع مفاتيح لوحة المفاتيح
   */
  _onKeyDown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1);
        this._updateActive();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, 0);
        this._updateActive();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.activeIndex >= 0 && this.activeIndex < this.filtered.length) {
          this._select(this.filtered[this.activeIndex]);
        }
        break;

      case 'Escape':
        this._close();
        break;
    }
  }

  /**
   * عرض الاقتراحات
   */
  _render(query) {
    this.listEl.innerHTML = '';

    this.filtered.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      if (index === this.activeIndex) div.classList.add('active');

      // تمييز النص المطابق
      const displayName = item.name;
      const lowerName = displayName.toLowerCase();
      const matchIndex = lowerName.indexOf(query);
      
      if (matchIndex >= 0) {
        const before = displayName.substring(0, matchIndex);
        const match = displayName.substring(matchIndex, matchIndex + query.length);
        const after = displayName.substring(matchIndex + query.length);
        div.innerHTML = `${before}<mark>${match}</mark>${after}`;
      } else {
        div.textContent = displayName;
      }

      div.addEventListener('click', () => this._select(item));
      div.addEventListener('mouseenter', () => {
        this.activeIndex = index;
        this._updateActive();
      });

      this.listEl.appendChild(div);
    });
  }

  /**
   * تحديث العنصر النشط
   */
  _updateActive() {
    const items = this.listEl.querySelectorAll('.suggestion-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this.activeIndex);
    });

    // التمرير للعنصر النشط
    if (this.activeIndex >= 0 && items[this.activeIndex]) {
      items[this.activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * اختيار اقتراح
   */
  _select(item) {
    this.input.value = '';
    this._close();
    if (this.onSelect) {
      this.onSelect(item.name);
    }
    this.input.focus();
  }

  /**
   * فتح القائمة
   */
  _open() {
    this.isOpen = true;
    this.listEl.classList.add('show');
  }

  /**
   * إغلاق القائمة
   */
  _close() {
    this.isOpen = false;
    this.activeIndex = -1;
    this.listEl.classList.remove('show');
  }

  /**
   * تنظيف
   */
  clear() {
    this.input.value = '';
    this._close();
  }
}
