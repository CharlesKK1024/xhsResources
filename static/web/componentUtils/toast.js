(function () {
  'use strict'

  let toastTimer = null
  let toastEl = null

  function getOrCreateToast() {
    if (toastEl && document.body.contains(toastEl)) return toastEl
    toastEl = document.createElement('div')
    toastEl.className = 'xhs-toast'
    toastEl.setAttribute('aria-live', 'polite')
    document.body.appendChild(toastEl)
    return toastEl
  }

  window.showToast = function (message, duration) {
    if (duration === undefined || duration === null) duration = 2000
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
    const el = getOrCreateToast()
    el.textContent = message
    el.classList.add('xhs-toast--visible')
    toastTimer = setTimeout(function () {
      el.classList.remove('xhs-toast--visible')
      toastTimer = null
    }, duration)
  }

})()
