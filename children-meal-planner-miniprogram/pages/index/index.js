const DATA = require('../../utils/data.js');

const STORAGE_KEY = 'meal-planner-dish-state-mini';
const NOTE_KEY = 'meal-planner-notes-mini';
const HERO_ICONS = {
  'page-0-6': '/assets/age-icons/bottle.png',
  'page-7-12': '/assets/age-icons/spoon.png',
  'page-13-24': '/assets/age-icons/fork-spoon.png',
  'page-2-3': '/assets/age-icons/chopsticks.png',
  'page-4-6': '/assets/age-icons/ball.png',
  'page-6-10': '/assets/age-icons/bike.png',
  'page-11-13': '/assets/age-icons/racket.png'
};

function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
function makeEmptyMeals() { return { breakfast: [], lunch: [], dinner: [], soup: [] }; }
function createState() {
  const selections = {};
  const removedDishes = {};
  const collapsed = {};
  DATA.AGE_PAGES.forEach((page) => {
    if (!page.hasMeals) return;
    selections[page.id] = { single: makeEmptyMeals(), custom: makeEmptyMeals(), weekly: {} };
    DATA.DAY_KEYS.forEach((day) => {
      selections[page.id].weekly[day] = { ...makeEmptyMeals(), custom: makeEmptyMeals() };
    });
    removedDishes[page.id] = makeEmptyMeals();
    collapsed[page.id] = { breakfast: false, lunch: false, dinner: false, soup: false };
  });
  return { selections, removedDishes, collapsed };
}

Page({
  data: {
    agePages: [],
    currentPageId: 'page-0-6',
    currentPage: {},
    globalWarnings: DATA.GLOBAL_WARNINGS,
    days: DATA.DAYS.map((name, index) => ({ name, key: DATA.DAY_KEYS[index] })),
    mode: 'single',
    currentDay: 'mon',
    selections: {},
    removedDishes: {},
    collapsed: {},
    mealBlocks: [],
    summary: makeEmptyMeals(),
    notes: {},
    addForm: { meal: '', name: '', emoji: '🍚' },
    emojiChoices: ['🍚', '🥣', '🥬', '🥕', '🥚', '🐟', '🍗', '🥔', '🍎', '🍌', '🥛', '🍲', '🥦', '🍅', '🌽', '🍠', '🥒', '🥑', '🍆', '🍄', '🥗', '🍜', '🍞', '🥞', '🧀', '🦐', '🥩', '🍖', '🥟', '🍙', '🍐', '🍊'],
    mealNavItems: [
      { key: 'breakfast', label: '早餐' },
      { key: 'lunch', label: '午餐' },
      { key: 'dinner', label: '晚餐' },
      { key: 'soup', label: '汤品' }
    ],
    activeMealKey: 'breakfast',
    showPoster: false,
    posterImage: '',
    posterHeight: 760
  },

  onLoad() {
    const initial = createState();
    const saved = wx.getStorageSync(STORAGE_KEY) || {};
    const notes = wx.getStorageSync(NOTE_KEY) || {};
    this.setData({
      agePages: DATA.AGE_PAGES,
      selections: saved.selections || initial.selections,
      removedDishes: saved.removedDishes || initial.removedDishes,
      collapsed: saved.collapsed || initial.collapsed,
      notes
    }, () => this.refreshView());
  },

  refreshView() {
    const page = DATA.AGE_PAGES.find((item) => item.id === this.data.currentPageId) || DATA.AGE_PAGES[0];
    const visualIcon = HERO_ICONS[page.id] || '🍽️';
    const currentPage = { ...page, visualIcon, visualIsImage: visualIcon.indexOf('/') === 0 };
    const mealBlocks = page.hasMeals ? DATA.MEAL_KEYS.map((meal) => this.buildMealBlock(page.id, meal)) : [];
    const summary = {};
    DATA.MEAL_KEYS.forEach((meal) => {
      const block = mealBlocks.find((item) => item.key === meal);
      summary[meal] = block ? block.selectedDishes.length : 0;
    });
    this.setData({ currentPage, mealBlocks, summary });
  },

  buildMealBlock(pageId, meal) {
    const selectedIds = this.getSelectedIds(pageId, meal);
    const dishes = this.getCandidateDishes(pageId, meal).map((dish) => ({
      ...dish,
      selected: selectedIds.includes(dish.id),
      isCustom: dish.id.indexOf('custom_') === 0
    }));
    const selectedDishes = selectedIds
      .map((id) => this.getDish(pageId, meal, id))
      .filter(Boolean)
      .map((dish) => ({ ...dish, isCustom: dish.id.indexOf('custom_') === 0 }));
    return {
      key: meal,
      name: DATA.MEAL_NAMES[meal],
      badge: DATA.MEAL_BADGE[meal],
      icon: DATA.MEAL_ICON[meal],
      subtitle: DATA.MEAL_SUBTITLE[meal],
      collapsed: !!this.data.collapsed[pageId][meal],
      dishes,
      selectedDishes
    };
  },

  getPageSelection(pageId) {
    return this.data.selections[pageId];
  },

  getBaseSelection(pageId) {
    const pageSelection = this.getPageSelection(pageId);
    if (!pageSelection) return null;
    return this.data.mode === 'single' ? pageSelection.single : pageSelection.weekly[this.data.currentDay];
  },

  getCustomSource(pageId) {
    const pageSelection = this.getPageSelection(pageId);
    if (!pageSelection) return null;
    return this.data.mode === 'single' ? pageSelection.custom : pageSelection.weekly[this.data.currentDay].custom;
  },

  getSelectedIds(pageId, meal) {
    const base = this.getBaseSelection(pageId);
    return base && base[meal] ? base[meal] : [];
  },

  getCandidateDishes(pageId, meal) {
    const originals = (DATA.DISH_DATA[pageId] && DATA.DISH_DATA[pageId][meal]) || [];
    const removed = this.data.removedDishes[pageId] ? this.data.removedDishes[pageId][meal] || [] : [];
    const customSource = this.getCustomSource(pageId);
    const custom = customSource ? customSource[meal] || [] : [];
    return originals.filter((dish) => !removed.includes(dish.id)).concat(custom);
  },

  getDish(pageId, meal, dishId) {
    return this.getCandidateDishes(pageId, meal).find((dish) => dish.id === dishId);
  },

  persist() {
    wx.setStorageSync(STORAGE_KEY, {
      selections: this.data.selections,
      removedDishes: this.data.removedDishes,
      collapsed: this.data.collapsed
    });
  },

  resetAddForm() {
    return { meal: '', name: '', emoji: '🍚' };
  },

  switchPage(event) {
    this.setData({ currentPageId: event.currentTarget.dataset.id, addForm: this.resetAddForm() }, () => this.refreshView());
  },

  switchMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode, addForm: this.resetAddForm() }, () => this.refreshView());
  },

  switchDay(event) {
    this.setData({ currentDay: event.currentTarget.dataset.day, addForm: this.resetAddForm() }, () => this.refreshView());
  },

  tapMealNav(event) {
    this.scrollToMeal(event.currentTarget.dataset.meal);
  },

  scrollToMeal(meal) {
    if (!meal || !this.data.currentPage.hasMeals) return;
    const shouldVibrate = this.data.activeMealKey !== meal;
    this.setData({ activeMealKey: meal });
    if (shouldVibrate && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    wx.pageScrollTo({
      selector: '#meal-' + meal,
      duration: 260,
      offsetTop: -16
    });
  },

  toggleCollapse(event) {
    const meal = event.currentTarget.dataset.meal;
    const pageId = this.data.currentPageId;
    const collapsed = deepClone(this.data.collapsed);
    collapsed[pageId][meal] = !collapsed[pageId][meal];
    this.setData({ collapsed }, () => {
      this.persist();
      this.refreshView();
    });
  },

  toggleDish(event) {
    const { meal, id } = event.currentTarget.dataset;
    const pageId = this.data.currentPageId;
    const selections = deepClone(this.data.selections);
    const base = this.data.mode === 'single' ? selections[pageId].single : selections[pageId].weekly[this.data.currentDay];
    const index = base[meal].indexOf(id);
    if (index >= 0) base[meal].splice(index, 1);
    else base[meal].push(id);
    this.setData({ selections }, () => {
      this.persist();
      this.refreshView();
    });
  },

  removeDish(event) {
    const { meal, id } = event.currentTarget.dataset;
    this.removeDishById(meal, id, true);
  },

  deleteDish(event) {
    const { meal, id } = event.currentTarget.dataset;
    if (id.indexOf('custom_') === 0) {
      this.removeDishById(meal, id, true);
      return;
    }
    const pageId = this.data.currentPageId;
    const selections = deepClone(this.data.selections);
    const removedDishes = deepClone(this.data.removedDishes);
    const base = this.data.mode === 'single' ? selections[pageId].single : selections[pageId].weekly[this.data.currentDay];
    const selectedIndex = base[meal].indexOf(id);
    if (selectedIndex >= 0) base[meal].splice(selectedIndex, 1);
    if (!removedDishes[pageId][meal].includes(id)) removedDishes[pageId][meal].push(id);
    this.setData({ selections, removedDishes }, () => {
      this.persist();
      this.refreshView();
    });
  },

  removeDishById(meal, id, removeCustom) {
    const pageId = this.data.currentPageId;
    const selections = deepClone(this.data.selections);
    const base = this.data.mode === 'single' ? selections[pageId].single : selections[pageId].weekly[this.data.currentDay];
    const index = base[meal].indexOf(id);
    if (index >= 0) base[meal].splice(index, 1);
    if (removeCustom && id.indexOf('custom_') === 0) {
      const custom = this.data.mode === 'single' ? selections[pageId].custom : selections[pageId].weekly[this.data.currentDay].custom;
      custom[meal] = custom[meal].filter((dish) => dish.id !== id);
    }
    this.setData({ selections }, () => {
      this.persist();
      this.refreshView();
    });
  },

  clearCurrent() {
    const pageId = this.data.currentPageId;
    const selections = deepClone(this.data.selections);
    const base = this.data.mode === 'single' ? selections[pageId].single : selections[pageId].weekly[this.data.currentDay];
    DATA.MEAL_KEYS.forEach((meal) => { base[meal] = []; });
    this.setData({ selections }, () => {
      this.persist();
      this.refreshView();
      wx.showToast({ title: '已清空', icon: 'success' });
    });
  },

  resetCurrentPage() {
    const pageId = this.data.currentPageId;
    const removedDishes = deepClone(this.data.removedDishes);
    DATA.MEAL_KEYS.forEach((meal) => { removedDishes[pageId][meal] = []; });
    this.setData({ removedDishes }, () => {
      this.persist();
      this.refreshView();
      wx.showToast({ title: '已恢复', icon: 'success' });
    });
  },

  showAddForm(event) {
    this.setData({ addForm: { meal: event.currentTarget.dataset.meal, name: '', emoji: '🍚' } });
  },

  onAddNameInput(event) {
    this.setData({ 'addForm.name': event.detail.value });
  },

  pickEmoji(event) {
    this.setData({ 'addForm.emoji': event.currentTarget.dataset.emoji });
  },

  confirmAddDish() {
    const name = this.data.addForm.name.trim();
    const meal = this.data.addForm.meal;
    if (!name || !meal) {
      wx.showToast({ title: '请输入菜名', icon: 'none' });
      return;
    }
    const pageId = this.data.currentPageId;
    const selections = deepClone(this.data.selections);
    const customDish = {
      id: 'custom_' + Date.now(),
      name,
      emoji: this.data.addForm.emoji || '🍚',
      category: '自定义',
      desc: '家长自定义添加'
    };
    if (this.data.mode === 'single') {
      selections[pageId].custom[meal].push(customDish);
      selections[pageId].single[meal].push(customDish.id);
    } else {
      selections[pageId].weekly[this.data.currentDay].custom[meal].push(customDish);
      selections[pageId].weekly[this.data.currentDay][meal].push(customDish.id);
    }
    this.setData({ selections, addForm: this.resetAddForm() }, () => {
      this.persist();
      this.refreshView();
    });
  },

  cancelAddDish() {
    this.setData({ addForm: this.resetAddForm() });
  },

  onNoteInput(event) {
    const notes = { ...this.data.notes, [this.data.currentPageId]: event.detail.value };
    this.setData({ notes });
    wx.setStorageSync(NOTE_KEY, notes);
  },

  noop() {},

  closePoster() {
    this.setData({ showPoster: false });
  },

  exportMenu() {
    if (!this.data.currentPage.hasMeals) {
      wx.showToast({ title: '当前阶段无需排餐', icon: 'none' });
      return;
    }
    this.setData({ showPoster: true, posterImage: '' }, () => {
      this.drawPoster();
    });
  },

  drawPoster() {
    const lines = this.buildPosterLines();
    const width = 640;
    const lineHeight = 38;
    const posterHeight = Math.max(760, 260 + lines.length * lineHeight);
    this.setData({ posterHeight });

    const ctx = wx.createCanvasContext('posterCanvas', this);
    ctx.setFillStyle('#fff9f2');
    ctx.fillRect(0, 0, width, posterHeight);
    ctx.setFillStyle('#f4c7a8');
    ctx.fillRect(0, 0, width, 130);
    ctx.setFillStyle('#4a3f35');
    ctx.setFontSize(34);
    ctx.fillText('多吃快跑', 36, 56);
    ctx.setFontSize(22);
    ctx.setFillStyle('#7d7067');
    ctx.fillText(this.data.currentPage.label + ' · ' + (this.data.mode === 'single' ? '单日餐单' : '一周餐单'), 36, 96);

    let y = 170;
    ctx.setFillStyle('#4a3f35');
    ctx.setFontSize(28);
    lines.forEach((line) => {
      if (line.type === 'title') {
        ctx.setFillStyle('#d4946b');
        ctx.setFontSize(28);
        ctx.fillText(line.text, 36, y);
      } else {
        ctx.setFillStyle('#4a3f35');
        ctx.setFontSize(24);
        this.drawWrappedText(ctx, line.text, 36, y, 568, 32);
      }
      y += line.height || lineHeight;
    });

    ctx.setFillStyle('#a39585');
    ctx.setFontSize(20);
    ctx.fillText('餐单仅供家庭搭配参考，请结合宝宝情况调整。', 36, posterHeight - 38);
    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        width,
        height: posterHeight,
        destWidth: width * 2,
        destHeight: posterHeight * 2,
        success: (res) => {
          this.setData({ posterImage: res.tempFilePath });
        },
        fail: () => {
          wx.showToast({ title: '图片生成失败', icon: 'none' });
        }
      }, this);
    });
  },

  buildPosterLines() {
    const lines = [];
    const note = this.data.notes[this.data.currentPageId];
    if (note) lines.push({ type: 'text', text: '备注：' + note, height: 42 });
    if (this.data.mode === 'single') {
      this.data.mealBlocks.forEach((block) => {
        const names = block.selectedDishes.map((dish) => dish.emoji + dish.name).join('、') || '还没有选择';
        lines.push({ type: 'title', text: block.name, height: 42 });
        lines.push({ type: 'text', text: names, height: Math.ceil(names.length / 18) * 34 + 12 });
      });
      return lines;
    }

    const pageId = this.data.currentPageId;
    DATA.DAY_KEYS.forEach((dayKey, index) => {
      lines.push({ type: 'title', text: DATA.DAYS[index], height: 42 });
      DATA.MEAL_KEYS.forEach((meal) => {
        const ids = this.data.selections[pageId].weekly[dayKey][meal] || [];
        const custom = this.data.selections[pageId].weekly[dayKey].custom[meal] || [];
        const pool = ((DATA.DISH_DATA[pageId] && DATA.DISH_DATA[pageId][meal]) || []).concat(custom);
        const dishes = ids.map((id) => pool.find((dish) => dish.id === id)).filter(Boolean);
        if (dishes.length) {
          const text = DATA.MEAL_NAMES[meal] + '：' + dishes.map((dish) => dish.emoji + dish.name).join('、');
          lines.push({ type: 'text', text, height: Math.ceil(text.length / 18) * 34 + 10 });
        }
      });
    });
    return lines;
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = '';
    for (let i = 0; i < text.length; i += 1) {
      const testLine = line + text[i];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = text[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, y);
  },

  savePosterToAlbum() {
    if (!this.data.posterImage) {
      wx.showToast({ title: '图片还在生成', icon: 'none' });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImage,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: () => wx.showModal({
        title: '保存失败',
        content: '请在微信设置中允许保存到相册，或长按图片手动保存。',
        showCancel: false
      })
    });
  }
});
