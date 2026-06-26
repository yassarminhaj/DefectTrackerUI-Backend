(function () {
  var editorElement = document.querySelector("[data-steps-editor]");
  var htmlOutput = document.querySelector("[data-steps-html]");

  if (!editorElement || !htmlOutput || window.defectStepsEditor) {
    return;
  }

  var MIN_IMAGE_WIDTH = 120;
  var MAX_DEFAULT_IMAGE_WIDTH = 520;
  var savedRange = null;
  var selectedImageForKeyboard = null;

  editorElement.setAttribute("data-placeholder", "Enter steps to replicate...");

  function editorContains(node) {
    return !!node && (node === editorElement || editorElement.contains(node));
  }

  function cleanEditorHtml() {
    var clone = editorElement.cloneNode(true);
    clone.querySelectorAll(".image-resize-handle").forEach(function (handle) {
      handle.remove();
    });
    clone.querySelectorAll(".image-preview-handle").forEach(function (handle) {
      handle.remove();
    });
    clone.querySelectorAll(".resizable-image-node").forEach(function (node) {
      node.classList.remove("is-selected");
      node.removeAttribute("contenteditable");
    });
    clone.querySelectorAll("img").forEach(function (image) {
      image.removeAttribute("draggable");
      if (image.style.width) {
        var width = Number(image.getAttribute("width")) || parseFloat(image.style.width);
        if (Number.isFinite(width) && width > 0) {
          image.setAttribute("width", String(Math.round(width)));
        }
      }
    });
    return clone.innerHTML.trim();
  }

  function updateEmptyState() {
    var hasText = editorElement.textContent.trim().length > 0;
    var hasImage = !!editorElement.querySelector("img");
    editorElement.classList.toggle("is-empty", !hasText && !hasImage);
  }

  function updateOutput() {
    ensureImageControls();
    updateEmptyState();
    htmlOutput.value = cleanEditorHtml();
  }

  function saveSelection() {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }
    var range = selection.getRangeAt(0);
    if (editorContains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
      if (!rangeTouchesImageNode(range)) {
        clearImageSelection();
      }
    }
  }

  function currentRange() {
    var selection = window.getSelection();
    if (selection && selection.rangeCount) {
      var range = selection.getRangeAt(0);
      if (editorContains(range.commonAncestorContainer)) {
        return range.cloneRange();
      }
    }
    if (savedRange && editorContains(savedRange.commonAncestorContainer)) {
      return savedRange.cloneRange();
    }
    return null;
  }

  function nodeElement(node) {
    return node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
  }

  function rangeTouchesImageNode(range) {
    var element = nodeElement(range && range.commonAncestorContainer);
    return !!(element && element.closest && element.closest(".resizable-image-node"));
  }

  function closestEditableBlock(node) {
    var element = nodeElement(node);
    while (element && element !== editorElement) {
      if (element.classList && element.classList.contains("resizable-image-node")) {
        return null;
      }
      if (/^(P|DIV|LI|H1|H2|H3|H4|BLOCKQUOTE|PRE)$/i.test(element.tagName)) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  function blockIsEmpty(block) {
    return !!block && !block.querySelector("img") && block.textContent.trim().length === 0;
  }

  function defaultImageWidth() {
    var editorWidth = Math.max(0, editorElement.getBoundingClientRect().width - 32);
    return Math.max(MIN_IMAGE_WIDTH, Math.min(MAX_DEFAULT_IMAGE_WIDTH, Math.round(editorWidth || 420)));
  }

  function blankParagraph() {
    var paragraph = document.createElement("p");
    paragraph.appendChild(document.createElement("br"));
    return paragraph;
  }

  function isIgnorableTextNode(node) {
    return node && node.nodeType === Node.TEXT_NODE && !node.textContent.trim();
  }

  function previousContentSibling(node) {
    var sibling = node ? node.previousSibling : null;
    while (isIgnorableTextNode(sibling)) {
      sibling = sibling.previousSibling;
    }
    return nodeElement(sibling);
  }

  function nextContentSibling(node) {
    var sibling = node ? node.nextSibling : null;
    while (isIgnorableTextNode(sibling)) {
      sibling = sibling.nextSibling;
    }
    return nodeElement(sibling);
  }

  function isImageNode(node) {
    return !!(node && node.classList && node.classList.contains("resizable-image-node"));
  }

  function isTextBlock(node) {
    return !!(node && !isImageNode(node) && /^(P|DIV|LI|H1|H2|H3|H4|BLOCKQUOTE|PRE)$/i.test(node.tagName));
  }

  function placeCaretAtStart(element) {
    if (!element) {
      return;
    }
    var selection = window.getSelection();
    if (!selection) {
      return;
    }
    var range = document.createRange();
    range.setStart(element, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }

  function placeCaretAtEnd(element) {
    if (!element) {
      return;
    }
    var selection = window.getSelection();
    if (!selection) {
      return;
    }
    var range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }

  function moveCaretAfterImage(imageNode) {
    if (!imageNode) {
      return;
    }
    var next = nextContentSibling(imageNode);
    if (!next || isImageNode(next)) {
      next = blankParagraph();
      imageNode.parentNode.insertBefore(next, imageNode.nextSibling);
    }
    placeCaretAtStart(next);
  }

  function moveCaretBeforeImage(imageNode) {
    if (!imageNode) {
      return;
    }
    var previous = previousContentSibling(imageNode);
    if (!previous || isImageNode(previous)) {
      previous = blankParagraph();
      imageNode.parentNode.insertBefore(previous, imageNode);
    }
    placeCaretAtEnd(previous);
  }

  function clearImageSelection(exceptNode) {
    editorElement.querySelectorAll(".resizable-image-node.is-selected").forEach(function (node) {
      if (node !== exceptNode) {
        node.classList.remove("is-selected");
      }
    });
    if (!exceptNode || selectedImageForKeyboard !== exceptNode) {
      selectedImageForKeyboard = null;
    }
  }

  function selectImageNode(wrapper, allowKeyboardDelete) {
    clearImageSelection(wrapper);
    wrapper.classList.add("is-selected");
    selectedImageForKeyboard = allowKeyboardDelete ? wrapper : null;
  }

  function syncImageWidth(image, width) {
    var nextWidth = Math.max(MIN_IMAGE_WIDTH, Math.round(width || defaultImageWidth()));
    image.style.width = nextWidth + "px";
    image.setAttribute("width", String(nextWidth));
  }

  function bindImageResize(wrapper) {
    if (!wrapper || wrapper._stepsResizeBound) {
      return;
    }

    var image = wrapper.querySelector("img");
    var handle = wrapper.querySelector(".image-resize-handle");
    var preview = wrapper.querySelector(".image-preview-handle");
    if (!image || !handle) {
      return;
    }

    wrapper._stepsResizeBound = true;
    wrapper.contentEditable = "false";
    image.draggable = false;

    if (image.getAttribute("width")) {
      syncImageWidth(image, Number(image.getAttribute("width")));
    } else if (image.style.width) {
      syncImageWidth(image, parseFloat(image.style.width));
    }

    wrapper.addEventListener("pointerdown", function (event) {
      if (event.target === handle || event.target === preview || event.target.closest(".image-preview-handle")) {
        return;
      }
      selectImageNode(wrapper, true);
    });

    if (preview && !preview._stepsPreviewBound) {
      preview._stepsPreviewBound = true;
      preview.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.openStepsScreenshotPreview === "function") {
          window.openStepsScreenshotPreview(image.src, image.alt || "Steps screenshot");
        }
      });
    }

    handle.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      event.stopPropagation();
      selectImageNode(wrapper, true);

      var startX = event.clientX;
      var startWidth = image.getBoundingClientRect().width || Number(image.getAttribute("width")) || defaultImageWidth();
      var maxWidth = Math.max(MIN_IMAGE_WIDTH, editorElement.getBoundingClientRect().width - 32);

      function onMove(moveEvent) {
        var nextWidth = Math.max(MIN_IMAGE_WIDTH, Math.min(maxWidth, Math.round(startWidth + moveEvent.clientX - startX)));
        syncImageWidth(image, nextWidth);
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        updateOutput();
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  function createImageNode(src) {
    var wrapper = document.createElement("div");
    var image = document.createElement("img");
    var handle = document.createElement("span");
    var preview = document.createElement("button");

    wrapper.className = "resizable-image-node";
    wrapper.contentEditable = "false";
    image.src = src;
    image.alt = "Pasted reproduction screenshot";
    image.draggable = false;
    syncImageWidth(image, defaultImageWidth());
    handle.className = "image-resize-handle";
    handle.setAttribute("aria-hidden", "true");
    preview.type = "button";
    preview.className = "image-preview-handle";
    preview.textContent = "View";
    preview.title = "Preview screenshot";
    preview.setAttribute("aria-label", "Preview screenshot");

    wrapper.appendChild(image);
    wrapper.appendChild(preview);
    wrapper.appendChild(handle);
    bindImageResize(wrapper);
    return wrapper;
  }

  function ensureImageControls() {
    Array.prototype.slice.call(editorElement.querySelectorAll("img")).forEach(function (image) {
      var wrapper = image.closest(".resizable-image-node");
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "resizable-image-node";
        wrapper.contentEditable = "false";
        image.parentNode.insertBefore(wrapper, image);
        wrapper.appendChild(image);
      }

      if (!wrapper.querySelector(".image-resize-handle")) {
        var handle = document.createElement("span");
        handle.className = "image-resize-handle";
        handle.setAttribute("aria-hidden", "true");
        wrapper.appendChild(handle);
      }

      if (!wrapper.querySelector(".image-preview-handle")) {
        var preview = document.createElement("button");
        preview.type = "button";
        preview.className = "image-preview-handle";
        preview.textContent = "View";
        preview.title = "Preview screenshot";
        preview.setAttribute("aria-label", "Preview screenshot");
        wrapper.insertBefore(preview, wrapper.querySelector(".image-resize-handle"));
      }

      image.alt = image.alt || "Pasted reproduction screenshot";
      bindImageResize(wrapper);
    });
  }

  function insertAfter(referenceNode, nodes) {
    var parent = referenceNode.parentNode;
    var cursor = referenceNode;
    nodes.forEach(function (node) {
      parent.insertBefore(node, cursor.nextSibling);
      cursor = node;
    });
  }

  function appendNodes(nodes) {
    nodes.forEach(function (node) {
      editorElement.appendChild(node);
    });
  }

  function insertImageSources(sources, range) {
    if (!sources.length) {
      return;
    }

    clearImageSelection();

    var wrappers = sources.map(createImageNode);
    var caretParagraph = blankParagraph();
    var nodes = wrappers.concat(caretParagraph);
    var block = range ? closestEditableBlock(range.startContainer) : null;

    if (block && editorContains(block)) {
      if (blockIsEmpty(block)) {
        block.replaceWith.apply(block, nodes);
      } else {
        insertAfter(block, nodes);
      }
    } else if (range && editorContains(range.commonAncestorContainer)) {
      range.deleteContents();
      var fragment = document.createDocumentFragment();
      nodes.forEach(function (node) {
        fragment.appendChild(node);
      });
      range.insertNode(fragment);
    } else {
      appendNodes(nodes);
    }

    placeCaretAtStart(caretParagraph);
    clearImageSelection();
    updateOutput();
  }

  function readImageAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Image paste failed."));
      };
      reader.readAsDataURL(file);
    });
  }

  function clipboardImageFiles(event) {
    var data = event.clipboardData;
    var files = [];
    var seen = {};

    function addFile(file) {
      if (!file || !/^image\//i.test(file.type || "")) {
        return;
      }
      var key = [file.name || "clipboard-image", file.type, file.size, file.lastModified || 0].join("|");
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      files.push(file);
    }

    // Pasted screenshots are read only from clipboardData.items.
    // Reading the file-only clipboard view as well can duplicate the same screenshot in Chrome/Edge.
    Array.prototype.slice.call(data && data.items ? data.items : []).forEach(function (item) {
      if (item.type && item.type.indexOf("image/") === 0) {
        addFile(item.getAsFile());
      }
    });
    return files;
  }

  function handlePaste(event) {
    var files = clipboardImageFiles(event);
    if (!files.length) {
      window.setTimeout(updateOutput, 0);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    var insertionRange = currentRange();
    Promise.all(files.map(readImageAsDataUrl)).then(function (sources) {
      insertImageSources(sources.filter(Boolean), insertionRange);
    }).catch(function () {
      updateOutput();
    });
  }

  function handleKeydown(event) {
    if (event.key !== "Backspace" && event.key !== "Delete") {
      clearImageSelection();
      return;
    }
    var selected = editorElement.querySelector(".resizable-image-node.is-selected");
    if (selected && selected === selectedImageForKeyboard) {
      event.preventDefault();
      var nextCaret = selected.nextElementSibling || selected.previousElementSibling || blankParagraph();
      if (!nextCaret.parentElement) {
        selected.parentNode.insertBefore(nextCaret, selected.nextSibling);
      }
      selected.remove();
      selectedImageForKeyboard = null;
      placeCaretAtStart(nextCaret);
      updateOutput();
      return;
    }

    if (controlledDeleteNearImage(event.key === "Backspace" ? "deleteContentBackward" : "deleteContentForward")) {
      event.preventDefault();
    }
  }

  function controlledDeleteNearImage(inputType) {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) {
      return false;
    }

    var range = selection.getRangeAt(0);
    if (!editorContains(range.commonAncestorContainer)) {
      return false;
    }

    var block = closestEditableBlock(range.startContainer);
    if (!block || !blockIsEmpty(block)) {
      return false;
    }

    var previous = previousContentSibling(block);
    var next = nextContentSibling(block);
    var previousIsImage = isImageNode(previous);
    var nextIsImage = isImageNode(next);

    if (!previousIsImage && !nextIsImage) {
      return false;
    }

    if (inputType === "deleteContentForward") {
      if (previousIsImage && isTextBlock(next)) {
        block.remove();
        placeCaretAtStart(next);
      } else if (nextIsImage && isTextBlock(previous)) {
        block.remove();
        placeCaretAtEnd(previous);
      } else if (previousIsImage) {
        moveCaretAfterImage(previous);
      } else {
        moveCaretBeforeImage(next);
      }
    } else if (previousIsImage && isTextBlock(next)) {
      block.remove();
      placeCaretAtStart(next);
    } else if (nextIsImage && isTextBlock(previous)) {
      block.remove();
      placeCaretAtEnd(previous);
    } else if (previousIsImage) {
      moveCaretAfterImage(previous);
    } else {
      moveCaretBeforeImage(next);
    }

    clearImageSelection();
    updateOutput();
    return true;
  }

  function handleBeforeInput(event) {
    if (event.inputType !== "deleteContentBackward" && event.inputType !== "deleteContentForward") {
      return;
    }

    if (controlledDeleteNearImage(event.inputType)) {
      event.preventDefault();
    }
  }

  function setContent(html) {
    editorElement.innerHTML = html && String(html).trim() ? html : "<p><br></p>";
    ensureImageControls();
    updateOutput();
  }

  editorElement.addEventListener("focus", saveSelection);
  editorElement.addEventListener("keyup", saveSelection);
  editorElement.addEventListener("mouseup", function (event) {
    if (event.target.closest(".resizable-image-node")) {
      return;
    }
    saveSelection();
  });
  editorElement.addEventListener("input", function () {
    clearImageSelection();
    updateOutput();
  });
  editorElement.addEventListener("beforeinput", handleBeforeInput);
  editorElement.addEventListener("paste", handlePaste);
  editorElement.addEventListener("keydown", handleKeydown);
  editorElement.addEventListener("pointerdown", function (event) {
    if (!event.target.closest(".resizable-image-node")) {
      clearImageSelection();
    }
  });

  ensureImageControls();
  updateOutput();

  window.defectStepsEditor = {
    getHTML: function () {
      updateOutput();
      return htmlOutput.value;
    },
    commands: {
      setContent: setContent
    }
  };

  var form = editorElement.closest("form");
  if (form) {
    form.addEventListener("submit", function () {
      updateOutput();
    }, true);
  }
}());
