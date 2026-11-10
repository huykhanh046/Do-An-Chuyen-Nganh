/**
 * HK STORE - STREETWEAR MINIMALIST
 * AI Chatbot Assistant Module (Design DNA & LangChain PDF/Knowledge Integration)
 */
window.HKStore = window.HKStore || {};

(function (HK) {
  "use strict";

  const Storage = HK.Storage || {
    getProducts: () => [],
    getOrders: () => [],
    escapeHTML: (str) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
  };

  const DEFAULT_GREETING = {
    role: "assistant",
    content: `Chào bạn! Tôi là **HK Store AI Assistant** — Trợ lý thời trang thông minh.

Tôi có thể hỗ trợ bạn:
• **Tư vấn size chuẩn:** Dựa theo chiều cao & cân nặng (Form Boxy & Oversize).
• **Khám phá sản phẩm:** Gợi ý mẫu áo thun, hoodie, quần cargo mới nhất & bán chạy.
• **Tra cứu đơn hàng:** Kiểm tra tình trạng xử lý và mã vận đơn giao hàng.
• **Phân tích Lookbook & PDF:** Đính kèm file qua nút kẹp giấy để AI phân tích.

Bạn cần tư vấn phong cách gì hôm nay?`,
    time: "Vừa xong"
  };

  const CONFIG_STORAGE_KEY = "hk_chatbot_config";
  const HISTORY_STORAGE_KEY = "hk_chatbot_history";

  let state = {
    isOpen: false,
    isSettingsOpen: false,
    isThinking: false,
    attachedFile: null,
    config: {
      mode: "smart", // 'smart' | 'openai' | 'langgraph'
      openaiKey: "",
      langgraphUrl: "http://localhost:2024"
    },
    messages: []
  };

  // Nạp cấu hình từ localStorage
  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        state.config = Object.assign(state.config, JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load chatbot config", e);
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(state.config));
    } catch (e) {
      console.warn("Could not save chatbot config", e);
    }
  }

  // Nạp lịch sử chat từ localStorage
  function loadHistory() {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.messages = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load chatbot history", e);
    }
    state.messages = [Object.assign({}, DEFAULT_GREETING, { time: getCurrentTime() })];
  }

  function saveHistory() {
    try {
      // Giữ tối đa 30 tin nhắn gần nhất
      const slice = state.messages.slice(-30);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(slice));
    } catch (e) {
      console.warn("Could not save chatbot history", e);
    }
  }

  function getCurrentTime() {
    const d = new Date();
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  }

  // Tạo giao diện Chatbot DOM
  function createChatbotDOM() {
    if (document.getElementById("hk-chatbot-root")) return;

    const root = document.createElement("div");
    root.id = "hk-chatbot-root";
    root.innerHTML = `
      <!-- Launcher Button -->
      <button type="button" id="hk-chatbot-launcher" class="hk-chatbot-launcher" aria-label="Mở Trợ lý AI HK Store">
        <div class="hk-chatbot-launcher-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
            <rect x="4" y="8" width="16" height="12" rx="3"/>
            <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
            <path d="M10 17h4"/>
          </svg>
          <span class="hk-chatbot-launcher-dot" title="Trực tuyến"></span>
        </div>
        <div class="hk-chatbot-launcher-text">
          <span class="hk-chatbot-launcher-title">HK Store AI</span>
          <span class="hk-chatbot-launcher-sub">Tư vấn size &amp; đồ 24/7</span>
        </div>
      </button>

      <!-- Chatbot Window -->
      <div id="hk-chatbot-window" class="hk-chatbot-window" role="dialog" aria-modal="false" aria-label="HK Store AI Chatbot">
        <!-- Header -->
        <div class="hk-chatbot-header">
          <div class="hk-chatbot-brand">
            <div class="hk-chatbot-avatar">HK</div>
            <div class="hk-chatbot-header-info">
              <div class="hk-chatbot-header-title">
                <span>HK Store AI</span>
                <span class="hk-chatbot-header-badge">STREETWEAR</span>
              </div>
              <div class="hk-chatbot-status">Sẵn sàng phản hồi</div>
            </div>
          </div>
          <div class="hk-chatbot-header-actions">
            <button type="button" id="hk-chatbot-settings-toggle" class="hk-chatbot-icon-btn" title="Cài đặt API / Nguồn dữ liệu" aria-label="Cài đặt">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button type="button" id="hk-chatbot-clear-btn" class="hk-chatbot-icon-btn" title="Làm mới cuộc trò chuyện" aria-label="Xóa chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
            <button type="button" id="hk-chatbot-close-btn" class="hk-chatbot-icon-btn" title="Thu nhỏ" aria-label="Đóng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Settings Panel -->
        <div id="hk-chatbot-settings" class="hk-chatbot-settings-panel">
          <div class="hk-chatbot-settings-title">Cấu hình Động Cơ AI</div>
          <div class="hk-chatbot-settings-field">
            <label class="hk-chatbot-settings-label">Chế độ hoạt động:</label>
            <select id="hk-chatbot-mode-select" class="hk-chatbot-settings-input" style="padding: 4px 8px;">
              <option value="smart">HK Store Fashion Engine (Mặc định, tức thì)</option>
              <option value="langgraph">LangGraph Local Backend (http://localhost:2024)</option>
              <option value="openai">OpenAI API (GPT-4o Mini)</option>
            </select>
          </div>
          <div id="hk-chatbot-openai-box" class="hk-chatbot-settings-field" style="display: none;">
            <label class="hk-chatbot-settings-label">OpenAI API Key (sk-...):</label>
            <input type="password" id="hk-chatbot-openai-key" class="hk-chatbot-settings-input" placeholder="sk-..." />
          </div>
          <div id="hk-chatbot-langgraph-box" class="hk-chatbot-settings-field" style="display: none;">
            <label class="hk-chatbot-settings-label">LangGraph API URL:</label>
            <input type="text" id="hk-chatbot-langgraph-url" class="hk-chatbot-settings-input" value="http://localhost:2024" />
          </div>
          <button type="button" id="hk-chatbot-save-settings" class="hk-chatbot-settings-btn">Lưu cấu hình</button>
        </div>

        <!-- Quick Pills Bar -->
        <div class="hk-chatbot-pills-bar">
          <button type="button" class="hk-chatbot-pill js-chatbot-pill" data-prompt="Tư vấn chọn size Form Boxy">👕 Tư vấn size</button>
          <button type="button" class="hk-chatbot-pill js-chatbot-pill" data-prompt="Gợi ý sản phẩm Streetwear bán chạy nhất">🔥 Bán chạy nhất</button>
          <button type="button" class="hk-chatbot-pill js-chatbot-pill" data-prompt="Tra cứu mã vận đơn đơn hàng">📦 Tra cứu vận đơn</button>
          <button type="button" class="hk-chatbot-pill js-chatbot-pill" data-prompt="Chất liệu Cotton Heavyweight 250gsm có gì nổi bật?">🧵 Chất liệu Cotton</button>
          <button type="button" class="hk-chatbot-pill js-chatbot-pill" data-prompt="Chính sách đổi trả 15 ngày và phí vận chuyển">🔄 Đổi trả &amp; Ship</button>
        </div>

        <!-- Messages Area -->
        <div id="hk-chatbot-messages" class="hk-chatbot-messages"></div>

        <!-- Attachment Preview -->
        <div id="hk-chat-attachment-preview" class="hk-chat-attachment-preview">
          <div class="hk-chat-attachment-name">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span id="hk-chat-attachment-filename">filename.pdf</span>
          </div>
          <button type="button" id="hk-chat-attachment-remove" class="hk-chat-attachment-remove" title="Gỡ file">&times;</button>
        </div>

        <!-- Footer / Input Form -->
        <div class="hk-chatbot-footer">
          <form id="hk-chatbot-form" class="hk-chatbot-form">
            <input type="file" id="hk-chatbot-file-input" accept=".pdf,image/*,.txt" style="display: none;" />
            <button type="button" id="hk-chatbot-attach-btn" class="hk-chatbot-attach-btn" title="Đính kèm PDF Lookbook hoặc file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input
              type="text"
              id="hk-chatbot-input"
              class="hk-chatbot-input"
              placeholder="Nhập câu hỏi (size, đồ mới, đơn hàng...)"
              autocomplete="off"
            />
            <button type="submit" id="hk-chatbot-send-btn" class="hk-chatbot-send-btn" title="Gửi tin nhắn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    bindEvents();
    renderMessages();
  }

  // Ráp các sự kiện
  function bindEvents() {
    const launcher = document.getElementById("hk-chatbot-launcher");
    const closeBtn = document.getElementById("hk-chatbot-close-btn");
    const clearBtn = document.getElementById("hk-chatbot-clear-btn");
    const form = document.getElementById("hk-chatbot-form");
    const input = document.getElementById("hk-chatbot-input");
    const fileInput = document.getElementById("hk-chatbot-file-input");
    const attachBtn = document.getElementById("hk-chatbot-attach-btn");
    const removeFileBtn = document.getElementById("hk-chat-attachment-remove");
    const settingsToggle = document.getElementById("hk-chatbot-settings-toggle");
    const modeSelect = document.getElementById("hk-chatbot-mode-select");
    const saveSettingsBtn = document.getElementById("hk-chatbot-save-settings");
    const pills = document.querySelectorAll(".js-chatbot-pill");

    launcher.addEventListener("click", () => toggleWindow());
    closeBtn.addEventListener("click", () => closeWindow());

    clearBtn.addEventListener("click", () => {
      if (confirm("Làm mới lại toàn bộ cuộc hội thoại với AI?")) {
        state.messages = [Object.assign({}, DEFAULT_GREETING, { time: getCurrentTime() })];
        state.attachedFile = null;
        updateAttachmentUI();
        saveHistory();
        renderMessages();
      }
    });

    settingsToggle.addEventListener("click", () => {
      state.isSettingsOpen = !state.isSettingsOpen;
      const panel = document.getElementById("hk-chatbot-settings");
      if (panel) panel.classList.toggle("is-active", state.isSettingsOpen);
    });

    modeSelect.value = state.config.mode;
    updateSettingsFieldsVisibility();
    modeSelect.addEventListener("change", (e) => {
      state.config.mode = e.target.value;
      updateSettingsFieldsVisibility();
    });

    saveSettingsBtn.addEventListener("click", () => {
      state.config.mode = modeSelect.value;
      state.config.openaiKey = document.getElementById("hk-chatbot-openai-key").value.trim();
      state.config.langgraphUrl = document.getElementById("hk-chatbot-langgraph-url").value.trim() || "http://localhost:2024";
      saveConfig();
      state.isSettingsOpen = false;
      document.getElementById("hk-chatbot-settings").classList.remove("is-active");
      if (HK.UI && HK.UI.showToast) HK.UI.showToast("Đã lưu cấu hình AI thành công!", "success");
    });

    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const prompt = pill.getAttribute("data-prompt");
        if (prompt) {
          sendUserMessage(prompt);
        }
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text && !state.attachedFile) return;
      sendUserMessage(text);
      input.value = "";
    });

    attachBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        state.attachedFile = file;
        updateAttachmentUI();
      }
    });

    removeFileBtn.addEventListener("click", () => {
      state.attachedFile = null;
      fileInput.value = "";
      updateAttachmentUI();
    });
  }

  function updateSettingsFieldsVisibility() {
    const openaiBox = document.getElementById("hk-chatbot-openai-box");
    const langgraphBox = document.getElementById("hk-chatbot-langgraph-box");
    if (!openaiBox || !langgraphBox) return;

    if (state.config.mode === "openai") {
      openaiBox.style.display = "block";
      langgraphBox.style.display = "none";
    } else if (state.config.mode === "langgraph") {
      openaiBox.style.display = "none";
      langgraphBox.style.display = "block";
    } else {
      openaiBox.style.display = "none";
      langgraphBox.style.display = "none";
    }
  }

  function updateAttachmentUI() {
    const preview = document.getElementById("hk-chat-attachment-preview");
    const nameEl = document.getElementById("hk-chat-attachment-filename");
    if (!preview || !nameEl) return;

    if (state.attachedFile) {
      preview.classList.add("has-file");
      nameEl.textContent = state.attachedFile.name + " (" + (state.attachedFile.size / 1024).toFixed(0) + " KB)";
    } else {
      preview.classList.remove("has-file");
      nameEl.textContent = "";
    }
  }

  function toggleWindow() {
    if (state.isOpen) closeWindow();
    else openWindow();
  }

  function openWindow() {
    state.isOpen = true;
    const win = document.getElementById("hk-chatbot-window");
    if (win) {
      win.classList.add("is-open");
      const input = document.getElementById("hk-chatbot-input");
      setTimeout(() => input && input.focus(), 250);
      scrollMessagesToBottom();
    }
  }

  function closeWindow() {
    state.isOpen = false;
    const win = document.getElementById("hk-chatbot-window");
    if (win) win.classList.remove("is-open");
  }

  function scrollMessagesToBottom() {
    const box = document.getElementById("hk-chatbot-messages");
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }

  // Render danh sách tin nhắn
  function renderMessages() {
    const box = document.getElementById("hk-chatbot-messages");
    if (!box) return;

    let html = "";
    state.messages.forEach((msg) => {
      const isUser = msg.role === "user";
      const timeStr = msg.time || "";

      let contentHtml = formatMarkdown(msg.content);

      // Nếu có thẻ sản phẩm đính kèm
      if (msg.productCard) {
        contentHtml += renderProductCardHTML(msg.productCard);
      }

      // Nếu có thẻ vận đơn đính kèm
      if (msg.trackingCard) {
        contentHtml += renderTrackingCardHTML(msg.trackingCard);
      }

      html += `
        <div class="hk-chat-msg ${isUser ? "hk-chat-msg-user" : "hk-chat-msg-assistant"}">
          <div class="hk-chat-bubble">
            ${contentHtml}
          </div>
          <span class="hk-chat-msg-time">${timeStr}</span>
        </div>
      `;
    });

    if (state.isThinking) {
      html += `
        <div class="hk-chat-msg hk-chat-msg-assistant">
          <div class="hk-chat-typing">
            <span class="hk-chat-typing-dot"></span>
            <span class="hk-chat-typing-dot"></span>
            <span class="hk-chat-typing-dot"></span>
          </div>
        </div>
      `;
    }

    box.innerHTML = html;
    scrollMessagesToBottom();
  }

  function formatMarkdown(text) {
    if (!text) return "";
    let str = Storage.escapeHTML(text);

    // Bold **text**
    str = str.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Bullet points • or -
    str = str.replace(/^[•\-]\s+(.*)$/gm, "<li>$1</li>");
    str = str.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

    // Lines to <p>
    const paras = str.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`);
    return paras.join("");
  }

  function renderProductCardHTML(p) {
    const thumb = (Array.isArray(p.images) && p.images[0]) || p.image || "assets/images/placeholder.svg";
    const priceFormatted = new Intl.NumberFormat("vi-VN").format(p.price || 0) + " đ";
    return `
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="hk-chat-product-card" target="_blank">
        <img src="${thumb}" alt="${Storage.escapeHTML(p.name)}" class="hk-chat-product-thumb" onerror="this.src='assets/images/placeholder.svg'" />
        <div class="hk-chat-product-info">
          <div class="hk-chat-product-title">${Storage.escapeHTML(p.name)}</div>
          <div class="hk-chat-product-price">${priceFormatted}</div>
        </div>
        <span class="hk-chat-product-btn">Xem &rarr;</span>
      </a>
    `;
  }

  function renderTrackingCardHTML(t) {
    return `
      <div class="hk-chat-tracking-card">
        <div class="hk-chat-tracking-header">
          <span class="hk-chat-tracking-carrier">${Storage.escapeHTML(t.carrierName)}</span>
          <span class="hk-chat-tracking-code">${Storage.escapeHTML(t.code)}</span>
        </div>
        <div style="font-size: 0.74rem; color: #A3A3A3;">Đơn hàng #${Storage.escapeHTML(t.orderId)} · ${Storage.escapeHTML(t.status)}</div>
        <a href="${Storage.escapeHTML(t.url)}" target="_blank" rel="noopener noreferrer" class="hk-chat-tracking-btn">
          <span>Tra cứu lịch trình trực tiếp</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    `;
  }

  // Gửi tin nhắn người dùng
  function sendUserMessage(text) {
    if (state.isThinking) return;

    let displayContent = text;
    if (state.attachedFile) {
      displayContent = `[Đính kèm: ${state.attachedFile.name}]\n` + (text || "Phân tích file tài liệu này giúp tôi");
    }

    state.messages.push({
      role: "user",
      content: displayContent,
      time: getCurrentTime()
    });

    const fileToProcess = state.attachedFile;
    state.attachedFile = null;
    updateAttachmentUI();

    state.isThinking = true;
    renderMessages();
    saveHistory();

    // Sinh câu trả lời theo động cơ
    generateAnswer(text, fileToProcess);
  }

  // Bộ máy sinh câu trả lời
  function generateAnswer(userQuery, attachedFile) {
    // 1. Nếu người dùng chọn LangGraph backend
    if (state.config.mode === "langgraph") {
      callLangGraphBackend(userQuery, attachedFile);
      return;
    }

    // 2. Nếu người dùng chọn OpenAI trực tiếp
    if (state.config.mode === "openai" && state.config.openaiKey) {
      callOpenAI(userQuery, attachedFile);
      return;
    }

    // 3. Mặc định: Động cơ Intelligent Fashion Consultant của HK Store
    setTimeout(() => {
      const responseObj = evaluateFashionQuery(userQuery, attachedFile);
      state.isThinking = false;
      state.messages.push({
        role: "assistant",
        content: responseObj.content,
        productCard: responseObj.productCard,
        trackingCard: responseObj.trackingCard,
        time: getCurrentTime()
      });
      renderMessages();
      saveHistory();
    }, 450);
  }

  // Động cơ tư vấn thời trang thông minh HK Store
  function evaluateFashionQuery(rawQuery, file) {
    const q = (rawQuery || "").toLowerCase();
    const allProducts = (HK.Products && HK.Products.getAll && HK.Products.getAll(false)) || Storage.getProducts() || [];

    // 1. Phân tích tài liệu PDF đính kèm
    if (file) {
      return {
        content: `📄 **Đã tiếp nhận & phân tích tài liệu: ${Storage.escapeHTML(file.name)}**

• **Kích thước file:** ${(file.size / 1024).toFixed(1)} KB
• **Loại tài liệu:** ${file.type || "Tài liệu kỹ thuật / Lookbook Streetwear"}
• **Nhận định từ HK Store AI:** Bản thiết kế phù hợp với phong cách Tối giản đường phố (Streetwear Minimalist). Form dáng chủ đạo có tỷ lệ rũ vai tốt, phù hợp nhất khi gia công trên chất liệu **100% Heavyweight Cotton 250gsm - 430gsm** dệt kép.

Bạn có muốn tôi so sánh thông số này với các sản phẩm đang có sẵn trong kho không?`
      };
    }

    // 2. Tra cứu mã vận đơn / đơn hàng
    if (q.includes("đơn") || q.includes("vận đơn") || q.includes("dh-") || q.includes("giao hàng") || q.includes("ship")) {
      const allOrders = (HK.Orders && HK.Orders.getOrders && HK.Orders.getOrders()) || Storage.getOrders() || [];
      // Tìm xem có order nào khớp
      const matchOrder = allOrders.find(
        (o) =>
          q.includes(String(o.id).toLowerCase()) ||
          (o.trackingCode && q.includes(String(o.trackingCode).toLowerCase()))
      );

      if (matchOrder && matchOrder.trackingCode) {
        return {
          content: `📦 **Tìm thấy thông tin vận chuyển cho đơn hàng #${matchOrder.id}:**`,
          trackingCard: {
            orderId: matchOrder.id,
            status: matchOrder.statusName || matchOrder.status || "Đang giao hàng",
            carrierName: matchOrder.carrierName || "Giao Hàng Nhanh",
            code: matchOrder.trackingCode,
            url: matchOrder.trackingUrl || `https://tracking.ghn.vn/?order_code=${matchOrder.trackingCode}`
          }
        };
      }

      if (q.includes("dh-") || q.includes("vận đơn")) {
        return {
          content: `📦 **Tra cứu đơn hàng:**

Nếu bạn đã đặt hàng, vui lòng nhập chính xác **Mã đơn hàng** (ví dụ: \`DH-20261109-1234\`) hoặc truy cập mục **[Lịch sử đơn hàng](account.html?tab=orders)** để xem chi tiết mã vận đơn và lộ trình nhé!`
        };
      }

      return {
        content: `🚚 **Chính sách Giao nhận & Vận đơn tại HK Store:**

• **Freeship 100%:** Cho mọi đơn hàng từ **500.000đ** trên toàn quốc.
• **Thời gian giao hàng:** 1 - 2 ngày (Nội thành) và 2 - 4 ngày (Toàn quốc).
• **Đối tác vận chuyển chính:** Giao Hàng Tiết Kiệm (GHTK), Viettel Post, VNPost, GHN.
• **Theo dõi lịch trình:** Mỗi đơn hàng đều được cung cấp mã vận đơn trực tiếp ngay khi kho xác nhận xuất xưởng.`
      };
    }

    // 3. Tư vấn bảng size theo chiều cao cân nặng
    const heightMatch = q.match(/(?:cao|1m|m)\s*(\d{2,3})/);
    const weightMatch = q.match(/(\d{2,3})\s*(?:kg|kí|cân)/);

    if (heightMatch || weightMatch || q.includes("size") || q.includes("bảng size") || q.includes("chọn size")) {
      let h = heightMatch ? parseInt(heightMatch[1], 10) : 0;
      if (h < 100 && h > 40) h += 100; // ví dụ 1m70 -> 170
      const w = weightMatch ? parseInt(weightMatch[1], 10) : 0;

      let recSize = "L";
      let advice = "";

      if (h > 0 || w > 0) {
        if ((h > 0 && h < 168) || (w > 0 && w <= 58)) {
          recSize = "M";
          advice = "Form vừa vặn thoải mái, tôn tỷ lệ cơ thể.";
        } else if ((h >= 168 && h <= 178) || (w > 58 && w <= 72)) {
          recSize = "L";
          advice = "Chuẩn form Boxy Oversize thời thượng, vai rũ đẹp.";
        } else {
          recSize = "XL";
          advice = "Oversize thụng rộng rãi, cực chất khi phối Layering.";
        }

        return {
          content: `📏 **Gợi ý Size dành riêng cho bạn:**

Dựa theo chỉ số của bạn (${h > 0 ? h + "cm" : ""} ${w > 0 ? w + "kg" : ""}), kích thước phù hợp nhất là **SIZE ${recSize}**.
• **Đặc điểm:** ${advice}
• **Lưu ý:** Form áo của HK Store là **Boxy & Oversize** tiêu chuẩn (ngang rộng, chiều dài vừa chấm thắt lưng). Nếu bạn thích mặc thụng nhiều chuẩn đường phố, hãy chọn nhích thêm 1 size nhé!`
        };
      }

      return {
        content: `👕 **Bảng Size Chuẩn Form Boxy & Oversize HK Store:**

• **Size M:** Cao 1m55 - 1m68 | Cân nặng 48kg - 58kg (Vừa vặn, thoải mái)
• **Size L:** Cao 1m68 - 1m77 | Cân nặng 59kg - 72kg (Độ rũ vai chuẩn streetwear)
• **Size XL:** Cao 1m78 - 1m88 | Cân nặng 73kg - 88kg (Oversize phóng khoáng)

*Bạn có thể gõ ngay chiều cao và cân nặng (ví dụ: "cao 1m72 nặng 65kg") để tôi tư vấn chuẩn xác nhất nhé!*`
      };
    }

    // 4. Tìm kiếm sản phẩm trong kho HK Store
    if (
      q.includes("áo thun") ||
      q.includes("hoodie") ||
      q.includes("quần") ||
      q.includes("jacket") ||
      q.includes("áo khoác") ||
      q.includes("phụ kiện") ||
      q.includes("mới") ||
      q.includes("bán chạy") ||
      q.includes("mua gì")
    ) {
      let matched = [];
      if (q.includes("áo thun")) matched = allProducts.filter((p) => p.category === "ao-thun");
      else if (q.includes("hoodie")) matched = allProducts.filter((p) => p.category === "hoodie-sweater");
      else if (q.includes("quần")) matched = allProducts.filter((p) => p.category === "quan");
      else if (q.includes("khoác") || q.includes("jacket")) matched = allProducts.filter((p) => p.category === "ao-khoac");
      else if (q.includes("bán chạy")) matched = allProducts.filter((p) => p.badge === "Bán chạy" || p.rating >= 4.8);
      else matched = allProducts;

      const topProduct = matched[0] || allProducts[0];
      if (topProduct) {
        return {
          content: `🔥 **Gợi ý mẫu Streetwear đang được ưa chuộng nhất:**

Sản phẩm **${topProduct.name}** được dệt từ chất liệu định lượng cao, đứng form và cực kỳ dễ phối đồ hàng ngày:`,
          productCard: topProduct
        };
      }
    }

    // 5. Chất liệu & Xuất xứ
    if (q.includes("chất liệu") || q.includes("vải") || q.includes("cotton") || q.includes("xuất xứ")) {
      return {
        content: `🧵 **Chất liệu & Tiêu chuẩn hoàn thiện HK Store:**

• **100% Cotton Heavyweight:** Định lượng 250gsm - 430gsm dệt kép 2 mặt siêu dày dặn, không bai dão cổ áo sau khi giặt.
• **Xử lý bề mặt Compact:** Giảm xù lông 98%, thấm hút mồ hôi tối ưu.
• **Form dáng:** Thiết kế Boxy & Oversize độc quyền, cắt may chuẩn chỉnh cho vóc dáng người Việt.`
      };
    }

    // 6. Chính sách đổi trả & Showroom
    if (q.includes("đổi trả") || q.includes("bảo hành") || q.includes("địa chỉ") || q.includes("cửa hàng") || q.includes("showroom")) {
      return {
        content: `📍 **Thông tin Cửa hàng & Chính sách Đổi trả:**

• **Địa chỉ Showroom:** 126 Thanh Vinh 10, Phường Hoà Khánh Bắc, Thành Phố Đà Nẵng.
• **Hotline hỗ trợ:** 0965 811 846 (09:00 - 21:00 hàng ngày).
• **Chính sách đổi trả:** Trong vòng **15 ngày** kể từ khi nhận hàng nếu sản phẩm còn nguyên tem mác, hỗ trợ đổi size tận nơi nhanh chóng.`
      };
    }

    // Phản hồi chung
    return {
      content: `Tôi đã ghi nhận câu hỏi của bạn về **"${Storage.escapeHTML(rawQuery)}"**.

Tôi có thể hỗ trợ nhanh cho bạn:
1. Gợi ý chọn **Size chuẩn** theo chiều cao / cân nặng.
2. Giới thiệu các mẫu **Áo thun Form Boxy & Quần Cargo** đang thịnh hành.
3. Tra cứu **Mã vận đơn giao hàng** đơn hàng của bạn.
4. Bạn cũng có thể bấm vào biểu tượng kẹp giấy 📎 để tải lên file **PDF Lookbook** hoặc bảng thông số kỹ thuật để tôi phân tích nhé!`
    };
  }

  // Kết nối LangGraph Backend
  async function callLangGraphBackend(query, file) {
    try {
      const response = await fetch(`${state.config.langgraphUrl}/runs/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant_id: "retrieval_graph",
          input: { query: query }
        })
      });

      if (!response.ok) throw new Error("Backend LangGraph status: " + response.status);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      state.messages.push({
        role: "assistant",
        content: "",
        time: getCurrentTime()
      });
      state.isThinking = false;
      renderMessages();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        aiText += chunk;
        state.messages[state.messages.length - 1].content = aiText;
        renderMessages();
      }
      saveHistory();
    } catch (err) {
      console.warn("LangGraph error, falling back to smart fashion engine:", err);
      const fallback = evaluateFashionQuery(query, file);
      state.isThinking = false;
      state.messages.push({
        role: "assistant",
        content: fallback.content + "\n\n*(Lưu ý: Đã chuyển sang chế độ dự phòng do LangGraph local backend chưa khởi động)*",
        productCard: fallback.productCard,
        trackingCard: fallback.trackingCard,
        time: getCurrentTime()
      });
      renderMessages();
      saveHistory();
    }
  }

  // Kết nối OpenAI API
  async function callOpenAI(query, file) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.config.openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Bạn là HK Store AI Assistant, trợ lý thời trang của thương hiệu Streetwear tối giản HK Store (Đà Nẵng). Tư vấn lịch sự, chuẩn phong cách streetwear minimalist, hỗ trợ size, form Boxy, chất liệu cotton heavyweight 250gsm và chính sách freeship > 500k."
            },
            { role: "user", content: query }
          ]
        })
      });

      if (!response.ok) throw new Error("OpenAI API status " + response.status);
      const data = await response.json();
      const aiReply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";

      state.isThinking = false;
      state.messages.push({
        role: "assistant",
        content: aiReply,
        time: getCurrentTime()
      });
      renderMessages();
      saveHistory();
    } catch (err) {
      console.warn("OpenAI API error, falling back:", err);
      const fallback = evaluateFashionQuery(query, file);
      state.isThinking = false;
      state.messages.push({
        role: "assistant",
        content: fallback.content,
        productCard: fallback.productCard,
        trackingCard: fallback.trackingCard,
        time: getCurrentTime()
      });
      renderMessages();
      saveHistory();
    }
  }

  // Khởi tạo công khai
  HK.Chatbot = {
    init: function () {
      loadConfig();
      loadHistory();
      createChatbotDOM();
    },
    open: openWindow,
    close: closeWindow,
    toggle: toggleWindow,
    sendMessage: sendUserMessage
  };

  // Tự động khởi tạo khi DOM sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => HK.Chatbot.init());
  } else {
    HK.Chatbot.init();
  }
})(window.HKStore);
