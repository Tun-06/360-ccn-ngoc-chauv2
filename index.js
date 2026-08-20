/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function () {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function () {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function () {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function (data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100 * Math.PI / 180, 120 * Math.PI / 180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function (hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function (hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create photo hotspots.
    if (data.photoHotspots) {
      data.photoHotspots.forEach(function (hotspot) {
        var element = createPhotoHotspotElement(hotspot);
        scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      });
    }

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI / 2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function () {
      screenfull.toggle();
    });
    screenfull.on('change', function () {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function (scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function () {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement', new Marzipano.ElementPressControlMethod(viewUpElement, 'y', -velocity, friction), true);
  controls.registerMethod('downElement', new Marzipano.ElementPressControlMethod(viewDownElement, 'y', velocity, friction), true);
  controls.registerMethod('leftElement', new Marzipano.ElementPressControlMethod(viewLeftElement, 'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement, 'x', velocity, friction), true);
  controls.registerMethod('inElement', new Marzipano.ElementPressControlMethod(viewInElement, 'zoom', -velocity, friction), true);
  controls.registerMethod('outElement', new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom', velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    if (!scene) return;
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
    updatePopupSelection(scene.data.id);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create blue pulsing map dot element (from THAMQUANDUAN)
    var icon = document.createElement('div');
    icon.classList.add('map-dot-icon');

    // Add click event handler.
    wrapper.addEventListener('click', function () {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');

    var targetData = findSceneDataById(hotspot.target);
    var cleanName = '';
    if (targetData && targetData.name) {
      cleanName = targetData.name
        .replace(/^\d+\.\s*/, '')
        .replace(/^360\s+topdown\s*[-–—]?\s*/i, '')
        .replace(/^360\s*[-–—]?\s*/i, '')
        .trim();
    }
    tooltip.setAttribute('data-original-text', cleanName);
    var translatedName = (typeof HOTSPOT_TRANSLATIONS !== 'undefined' && HOTSPOT_TRANSLATIONS[cleanName] && HOTSPOT_TRANSLATIONS[cleanName][currentLanguage])
      ? HOTSPOT_TRANSLATIONS[cleanName][currentLanguage]
      : cleanName;
    tooltip.textContent = translatedName;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function () {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  function createPhotoHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');
    wrapper.classList.add('photo-hotspot');

    var icon = document.createElement('div');
    icon.classList.add('map-dot-icon');

    wrapper.addEventListener('click', function (e) {
      e.stopPropagation();
      var modal = document.querySelector('#' + hotspot.modalId);
      if (modal) {
        modal.classList.add('show');
      }
    });

    stopTouchAndScrollEventPropagation(wrapper);

    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');

    var title = hotspot.title || 'Ảnh Cổng chính';
    tooltip.setAttribute('data-original-text', title);
    var translatedName = (typeof HOTSPOT_TRANSLATIONS !== 'undefined' && HOTSPOT_TRANSLATIONS[title] && HOTSPOT_TRANSLATIONS[title][currentLanguage])
      ? HOTSPOT_TRANSLATIONS[title][currentLanguage]
      : title;
    tooltip.textContent = translatedName;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = ['touchstart', 'touchmove', 'touchend', 'touchcancel',
      'wheel', 'mousewheel'];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function (event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Scene ID Mapping for THAM QUAN Popup Items
  var sceneMap = {
    'cong-chinh': '1-2-360---cong-chinh',
    'mat-truoc': '2-3-360---tong-the-mat-truoc',
    'mat-sau': '3-4-360---tong-the-mat-sau',
    'giao-thong': '4-5-360---duong-giao-thong-chinh',
    'nuoc-thai': '5-6-360---nha-dieu-hanh',
    'can-canh': '6-7-360---khu-dich-vu'
  };

  function updatePopupSelection(sceneId) {
    var popupItems = document.querySelectorAll('#tabThamQuan .popup-item');
    for (var i = 0; i < popupItems.length; i++) {
      var item = popupItems[i];
      var val = item.getAttribute('data-value');
      if (sceneMap[val] === sceneId) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    }
  }

  // Top right overlay click -> return to Trang chủ (360 Topdown)
  var topRightOverlay = document.querySelector('#topRightOverlay');
  if (topRightOverlay) {
    topRightOverlay.addEventListener('click', function () {
      var homeScene = findSceneById('0-1-360-topdown---trang-chu');
      if (homeScene) {
        switchScene(homeScene);
      }
    });
  }

  // Bottom menu popup items click
  var popupItems = document.querySelectorAll('.popup-item');
  for (var i = 0; i < popupItems.length; i++) {
    (function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        var val = item.getAttribute('data-value');
        if (val === 'tl-brochure') {
          var brochureModal = document.querySelector('#brochureModal');
          if (brochureModal) {
            brochureModal.classList.add('show');
          }
          return;
        }
        if (val === 'tl-phaply' || val === 'tl-tvc') {
          var tvcModal = document.querySelector('#tvcModal');
          var tvcVideo = document.querySelector('#tvcVideoPlayer');
          if (tvcModal) {
            tvcModal.classList.add('show');
            if (tvcVideo) {
              tvcVideo.currentTime = 0;
              tvcVideo.muted = false;
              tvcVideo.volume = 1.0;
              var playPromise = tvcVideo.play();
              if (playPromise !== undefined) {
                playPromise.catch(function (err) {
                  console.warn("Autoplay audio blocked by browser:", err);
                });
              }
            }
          }
          return;
        }
        if (val === 'tl-quyhoach') {
          var albumModal = document.querySelector('#albumModal');
          if (albumModal) {
            albumModal.classList.add('show');
            showAlbumImage(currentAlbumIndex);
          }
          return;
        }
        if (sceneMap[val]) {
          var targetScene = findSceneById(sceneMap[val]);
          if (targetScene) {
            switchScene(targetScene);
          }
        } else {
          var parentPopup = item.closest('.tab-popup');
          if (parentPopup) {
            var siblings = parentPopup.querySelectorAll('.popup-item');
            for (var j = 0; j < siblings.length; j++) {
              siblings[j].classList.remove('selected');
            }
          }
          item.classList.add('selected');
        }
      });
    })(popupItems[i]);
  }

  // Modal Ảnh Cổng Chính logic
  var congChinhModal = document.querySelector('#congChinhModal');
  var closeCongChinhModal = document.querySelector('#closeCongChinhModal');

  if (closeCongChinhModal && congChinhModal) {
    closeCongChinhModal.addEventListener('click', function (e) {
      e.stopPropagation();
      congChinhModal.classList.remove('show');
    });
  }

  if (congChinhModal) {
    congChinhModal.addEventListener('click', function (e) {
      if (e.target === congChinhModal) {
        congChinhModal.classList.remove('show');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && congChinhModal.classList.contains('show')) {
        congChinhModal.classList.remove('show');
      }
    });
  }

  // Modal Ảnh Tổng Thể Mặt Trước logic
  var matTruocModal = document.querySelector('#matTruocModal');
  var closeMatTruocModal = document.querySelector('#closeMatTruocModal');

  if (closeMatTruocModal && matTruocModal) {
    closeMatTruocModal.addEventListener('click', function (e) {
      e.stopPropagation();
      matTruocModal.classList.remove('show');
    });
  }

  if (matTruocModal) {
    matTruocModal.addEventListener('click', function (e) {
      if (e.target === matTruocModal) {
        matTruocModal.classList.remove('show');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && matTruocModal.classList.contains('show')) {
        matTruocModal.classList.remove('show');
      }
    });
  }

  // Modal Ảnh Tổng Thể Mặt Sau logic
  var matSauModal = document.querySelector('#matSauModal');
  var closeMatSauModal = document.querySelector('#closeMatSauModal');

  if (closeMatSauModal && matSauModal) {
    closeMatSauModal.addEventListener('click', function (e) {
      e.stopPropagation();
      matSauModal.classList.remove('show');
    });
  }

  if (matSauModal) {
    matSauModal.addEventListener('click', function (e) {
      if (e.target === matSauModal) {
        matSauModal.classList.remove('show');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && matSauModal.classList.contains('show')) {
        matSauModal.classList.remove('show');
      }
    });
  }

  // Modal Mặt Bằng logic
  var tabMatBang = document.querySelector('#tabMatBang');
  var matbangModal = document.querySelector('#matbangModal');
  var closeMatbangModal = document.querySelector('#closeMatbangModal');

  if (tabMatBang && matbangModal) {
    tabMatBang.addEventListener('click', function (e) {
      matbangModal.classList.add('show');
    });
  }

  if (closeMatbangModal && matbangModal) {
    closeMatbangModal.addEventListener('click', function (e) {
      e.stopPropagation();
      matbangModal.classList.remove('show');
    });
  }

  if (matbangModal) {
    matbangModal.addEventListener('click', function (e) {
      if (e.target === matbangModal) {
        matbangModal.classList.remove('show');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && matbangModal.classList.contains('show')) {
        matbangModal.classList.remove('show');
      }
    });
  }

  // Modal Brochure logic
  var brochureModal = document.querySelector('#brochureModal');
  var closeBrochureModal = document.querySelector('#closeBrochureModal');

  if (closeBrochureModal && brochureModal) {
    closeBrochureModal.addEventListener('click', function (e) {
      e.stopPropagation();
      brochureModal.classList.remove('show');
    });
  }

  if (brochureModal) {
    brochureModal.addEventListener('click', function (e) {
      if (e.target === brochureModal) {
        brochureModal.classList.remove('show');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && brochureModal.classList.contains('show')) {
        brochureModal.classList.remove('show');
      }
    });
  }

  // Modal TVC logic
  var tvcModal = document.querySelector('#tvcModal');
  var closeTvcModal = document.querySelector('#closeTvcModal');
  var tvcVideoPlayer = document.querySelector('#tvcVideoPlayer');

  function closeTvc() {
    if (tvcModal) {
      tvcModal.classList.remove('show');
    }
    if (tvcVideoPlayer) {
      tvcVideoPlayer.pause();
      tvcVideoPlayer.currentTime = 0;
    }
  }

  if (closeTvcModal) {
    closeTvcModal.addEventListener('click', function (e) {
      e.stopPropagation();
      closeTvc();
    });
  }

  if (tvcModal) {
    tvcModal.addEventListener('click', function (e) {
      if (e.target === tvcModal) {
        closeTvc();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && tvcModal.classList.contains('show')) {
        closeTvc();
      }
    });
  }

  // Album Ảnh Data & Logic
  var albumImages = [
    "img/5.Album ảnh/Bản sao của 1.jpg",
    "img/5.Album ảnh/Bản sao của 2(1).jpg",
    "img/5.Album ảnh/Bản sao của 2.jpg",
    "img/5.Album ảnh/Bản sao của 3 - Night.png",
    "img/5.Album ảnh/Bản sao của 3.jpg",
    "img/5.Album ảnh/Bản sao của 3.png",
    "img/5.Album ảnh/Bản sao của 4.jpg",
    "img/5.Album ảnh/Bản sao của 5.jpg",
    "img/5.Album ảnh/Bản sao của 6.jpg",
    "img/5.Album ảnh/Bản sao của BT2 - 1.png",
    "img/5.Album ảnh/Bản sao của BT2 - 2.png",
    "img/5.Album ảnh/Bản sao của BT2 - 4.png",
    "img/5.Album ảnh/Bản sao của BT3 - 1.jpg",
    "img/5.Album ảnh/Bản sao của BT3 - 2.png",
    "img/5.Album ảnh/Bản sao của BT3 - 4.png",
    "img/5.Album ảnh/Bản sao của BT3 - 5.png",
    "img/5.Album ảnh/Bản sao của Da1.jpg",
    "img/5.Album ảnh/Bản sao của NDH2.jpg",
    "img/5.Album ảnh/Bản sao của cong 2.jpg",
    "img/5.Album ảnh/Bản sao của cong bs 1.jpg",
    "img/5.Album ảnh/Bản sao của cong bs 2.jpg",
    "img/5.Album ảnh/Bản sao của da2.jpg",
    "img/5.Album ảnh/Bản sao của da3.jpg"
  ];

  var currentAlbumIndex = 0;
  var albumModal = document.querySelector('#albumModal');
  var albumMainImg = document.querySelector('#albumMainImg');
  var albumCounter = document.querySelector('#albumCounter');
  var albumThumbsTrack = document.querySelector('#albumThumbsTrack');
  var closeAlbumModal = document.querySelector('#closeAlbumModal');
  var albumPrevBtn = document.querySelector('#albumPrevBtn');
  var albumNextBtn = document.querySelector('#albumNextBtn');
  var thumbScrollLeft = document.querySelector('#thumbScrollLeft');
  var thumbScrollRight = document.querySelector('#thumbScrollRight');

  function initAlbumThumbnails() {
    if (!albumThumbsTrack) return;
    albumThumbsTrack.innerHTML = '';
    albumImages.forEach(function (src, index) {
      var item = document.createElement('div');
      item.className = 'album-thumb-item' + (index === 0 ? ' active' : '');
      item.setAttribute('data-index', index);

      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Thumbnail ' + (index + 1);
      img.loading = 'lazy';

      item.appendChild(img);
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        showAlbumImage(index);
      });
      albumThumbsTrack.appendChild(item);
    });
  }

  // Build persistent gallery cards once
  var galleryCardsBuilt = false;
  var galleryCardEls = [];

  function initGalleryCards() {
    var stage = document.querySelector('#infiniteGalleryStage');
    if (!stage || galleryCardsBuilt) return;
    stage.innerHTML = '';
    galleryCardEls = [];
    albumImages.forEach(function (src, i) {
      var card = document.createElement('div');
      card.className = 'gallery-card card-hidden';
      card.setAttribute('data-album-idx', i);

      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Album photo ' + (i + 1);
      img.loading = 'lazy';
      card.appendChild(img);

      card.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(card.getAttribute('data-album-idx'), 10);
        if (idx !== currentAlbumIndex) {
          showAlbumImage(idx);
        }
      });

      stage.appendChild(card);
      galleryCardEls.push(card);
    });
    galleryCardsBuilt = true;
  }

  function showAlbumImage(index) {
    if (!albumImages.length) return;

    var len = albumImages.length;
    currentAlbumIndex = ((index % len) + len) % len;

    if (albumCounter) {
      var numStr = (currentAlbumIndex + 1) < 10 ? '0' + (currentAlbumIndex + 1) : (currentAlbumIndex + 1);
      albumCounter.textContent = numStr + ' / ' + len;
    }

    initGalleryCards();

    // Position each card relative to currentAlbumIndex
    for (var i = 0; i < galleryCardEls.length; i++) {
      var card = galleryCardEls[i];
      // Calculate shortest circular distance
      var diff = i - currentAlbumIndex;
      if (diff > len / 2) diff -= len;
      if (diff < -len / 2) diff += len;

      // Remove all position classes
      card.className = 'gallery-card';

      if (diff === 0) {
        card.classList.add('card-active');
      } else if (diff === -1) {
        card.classList.add('card-prev');
      } else if (diff === 1) {
        card.classList.add('card-next');
      } else if (diff === -2) {
        card.classList.add('card-far-prev');
      } else if (diff === 2) {
        card.classList.add('card-far-next');
      } else {
        card.classList.add('card-hidden');
      }
    }

    var thumbs = document.querySelectorAll('.album-thumb-item');
    for (var i = 0; i < thumbs.length; i++) {
      if (i === currentAlbumIndex) {
        thumbs[i].classList.add('active');
        thumbs[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        thumbs[i].classList.remove('active');
      }
    }
  }

  initAlbumThumbnails();

  if (albumPrevBtn) {
    albumPrevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      showAlbumImage(currentAlbumIndex - 1);
    });
  }

  if (albumNextBtn) {
    albumNextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      showAlbumImage(currentAlbumIndex + 1);
    });
  }

  if (thumbScrollLeft && albumThumbsTrack) {
    thumbScrollLeft.addEventListener('click', function (e) {
      e.stopPropagation();
      albumThumbsTrack.scrollBy({ left: -250, behavior: 'smooth' });
    });
  }

  if (thumbScrollRight && albumThumbsTrack) {
    thumbScrollRight.addEventListener('click', function (e) {
      e.stopPropagation();
      albumThumbsTrack.scrollBy({ left: 250, behavior: 'smooth' });
    });
  }

  if (closeAlbumModal && albumModal) {
    closeAlbumModal.addEventListener('click', function (e) {
      e.stopPropagation();
      albumModal.classList.remove('show');
    });
  }

  if (albumModal) {
    albumModal.addEventListener('click', function (e) {
      if (e.target === albumModal) {
        albumModal.classList.remove('show');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!albumModal.classList.contains('show')) return;
      if (e.key === 'Escape') {
        albumModal.classList.remove('show');
      } else if (e.key === 'ArrowLeft') {
        showAlbumImage(currentAlbumIndex - 1);
      } else if (e.key === 'ArrowRight') {
        showAlbumImage(currentAlbumIndex + 1);
      }
    });
  }

  // Multi-language (i18n) System
  var currentLanguage = 'vi';
  var TRANSLATIONS = {
    vi: {
      NAV_THAMQUAN: "THAM QUAN",
      NAV_VITRI: "VỊ TRÍ DỰ ÁN",
      NAV_MATBANG: "MẶT BẰNG",
      NAV_TAILIEU: "TÀI LIỆU",

      CONG_CHINH: "CỔNG CHÍNH",
      MAT_TRUOC: "TỔNG THỂ MẶT TRƯỚC",
      MAT_SAU: "TỔNG THỂ MẶT SAU",
      GIAO_THONG: "ĐƯỜNG GIAO THÔNG CHÍNH",
      NHA_DIEU_HANH: "NHÀ ĐIỀU HÀNH",
      KHU_DICH_VU: "KHU DỊCH VỤ",
      TRANG_CHU: "Trang chủ",

      TL_BROCHURE: "BROCHURE DỰ ÁN",
      TL_TVC: "TVC GIỚI THIỆU DỰ ÁN",
      TL_ALBUM: "ALBUM ẢNH",
      TL_WEBSITE: "WEBSITE",

      TITLE_BROCHURE: "BROCHURE DỰ ÁN CỤM CÔNG NGHIỆP NGỌC CHÂU",
      TITLE_TVC: "TVC GIỚI THIỆU DỰ ÁN CỤM CÔNG NGHIỆP NGỌC CHÂU",
      TITLE_ALBUM: "ALBUM ẢNH DỰ ÁN CỤM CÔNG NGHIỆP NGỌC CHÂU",
      TITLE_CONGCHINH_IMG: "ẢNH CỔNG CHÍNH - CỤM CÔNG NGHIỆP NGỌC CHÂU",
      TITLE_MATTRUOC_IMG: "ẢNH TỔNG THỂ MẶT TRƯỚC - CỤM CÔNG NGHIỆP NGỌC CHÂU",
      TITLE_MATSAU_IMG: "ẢNH TỔNG THỂ MẶT SAU - CỤM CÔNG NGHIỆP NGỌC CHÂU"
    },
    en: {
      NAV_THAMQUAN: "VIRTUAL TOUR",
      NAV_VITRI: "LOCATION",
      NAV_MATBANG: "MASTER PLAN",
      NAV_TAILIEU: "DOCUMENTS",

      CONG_CHINH: "MAIN GATE",
      MAT_TRUOC: "FRONT OVERVIEW",
      MAT_SAU: "BACK OVERVIEW",
      GIAO_THONG: "MAIN ROAD",
      NHA_DIEU_HANH: "OPERATIONS BUILDING",
      KHU_DICH_VU: "SERVICE AREA",
      TRANG_CHU: "Home Overview",

      TL_BROCHURE: "PROJECT BROCHURE",
      TL_TVC: "INTRO VIDEO (TVC)",
      TL_ALBUM: "PHOTO ALBUM",
      TL_WEBSITE: "WEBSITE",

      TITLE_BROCHURE: "BROCHURE - NGOC CHAU INDUSTRIAL CLUSTER",
      TITLE_TVC: "INTRO VIDEO (TVC) - NGOC CHAU INDUSTRIAL CLUSTER",
      TITLE_ALBUM: "PHOTO ALBUM - NGOC CHAU INDUSTRIAL CLUSTER",
      TITLE_CONGCHINH_IMG: "MAIN GATE PHOTO - NGOC CHAU INDUSTRIAL CLUSTER",
      TITLE_MATTRUOC_IMG: "FRONT OVERVIEW PHOTO - NGOC CHAU INDUSTRIAL CLUSTER",
      TITLE_MATSAU_IMG: "BACK OVERVIEW PHOTO - NGOC CHAU INDUSTRIAL CLUSTER"
    },
    cn: {
      NAV_THAMQUAN: "360全景",
      NAV_VITRI: "项目位置",
      NAV_MATBANG: "平面图",
      NAV_TAILIEU: "项目资料",

      CONG_CHINH: "正门",
      MAT_TRUOC: "前全景",
      MAT_SAU: "后全景",
      GIAO_THONG: "主干道",
      NHA_DIEU_HANH: "运营大楼",
      KHU_DICH_VU: "服务区",
      TRANG_CHU: "首页",

      TL_BROCHURE: "项目手册",
      TL_TVC: "宣传视频",
      TL_ALBUM: "项目相册",
      TL_WEBSITE: "官方网站",

      TITLE_BROCHURE: "玉州工业区项目手册",
      TITLE_TVC: "宣传视频 - 玉州工业区",
      TITLE_ALBUM: "玉州工业区项目相册",
      TITLE_CONGCHINH_IMG: "正门照片 - 玉州工业区",
      TITLE_MATTRUOC_IMG: "前全景照片 - 玉州工业区",
      TITLE_MATSAU_IMG: "后全景照片 - 玉州工业区"
    }
  };

  var HOTSPOT_TRANSLATIONS = {
    "Cổng chính": { vi: "Cổng chính", en: "Main Gate", cn: "正门" },
    "Ảnh Cổng chính": { vi: "Ảnh Cổng chính", en: "Main Gate Photo", cn: "正门照片" },
    "Ảnh Mặt trước": { vi: "Ảnh Mặt trước", en: "Front Overview Photo", cn: "前全景照片" },
    "Ảnh Mặt sau": { vi: "Ảnh Mặt sau", en: "Back Overview Photo", cn: "后全景照片" },
    "Tổng thể mặt trước": { vi: "Tổng thể mặt trước", en: "Front Overview", cn: "前全景" },
    "Tổng thể mặt sau": { vi: "Tổng thể mặt sau", en: "Back Overview", cn: "后全景" },
    "Đường giao thông chính": { vi: "Đường giao thông chính", en: "Main Road", cn: "主干道" },
    "Nhà điều hành": { vi: "Nhà điều hành", en: "Operations Building", cn: "运营大楼" },
    "Khu dịch vụ": { vi: "Khu dịch vụ", en: "Service Area", cn: "服务区" },
    "Trang chủ": { vi: "Trang chủ", en: "Home Overview", cn: "首页" }
  };

  function setLanguage(langCode) {
    if (!TRANSLATIONS[langCode]) return;
    currentLanguage = langCode;

    // 1. Update elements with data-i18n
    var i18nElements = document.querySelectorAll('[data-i18n]');
    i18nElements.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (TRANSLATIONS[langCode] && TRANSLATIONS[langCode][key]) {
        el.textContent = TRANSLATIONS[langCode][key];
      }
    });

    // 2. Update 360 hotspot tooltips
    var tooltips = document.querySelectorAll('.link-hotspot-tooltip');
    tooltips.forEach(function (tooltip) {
      var original = tooltip.getAttribute('data-original-text');
      if (original && HOTSPOT_TRANSLATIONS[original]) {
        tooltip.textContent = HOTSPOT_TRANSLATIONS[original][langCode] || original;
      }
    });
  }

  // Language Switcher Logic
  var langContainer = document.querySelector('#langSwitcherContainer');
  var currentLangIcon = document.querySelector('#currentLangIcon');
  var langOptions = document.querySelectorAll('.lang-option');

  if (langContainer) {
    langContainer.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('.lang-option')) return;
      langContainer.classList.toggle('open');
    });

    langOptions.forEach(function (option) {
      option.addEventListener('click', function (e) {
        e.stopPropagation();
        var selectedLang = option.getAttribute('data-lang');
        var selectedSvg = option.querySelector('.lang-flag-icon').innerHTML;
        if (currentLangIcon) {
          currentLangIcon.innerHTML = selectedSvg;
        }
        langOptions.forEach(function (opt) { opt.classList.remove('active'); });
        option.classList.add('active');
        langContainer.classList.remove('open');

        // Apply language translation across whole site
        setLanguage(selectedLang);
      });
    });

    document.addEventListener('click', function () {
      if (langContainer) {
        langContainer.classList.remove('open');
      }
    });
  }

  // Helper: Click on 360 viewer to log exact yaw & pitch in browser console (F12)
  panoElement.addEventListener('click', function (e) {
    var view = viewer.view();
    if (view && view.screenToCoordinates) {
      var coords = view.screenToCoordinates({ x: e.clientX, y: e.clientY });
      if (coords) {
        console.log("%c CLICKED COORDS -> yaw: " + coords.yaw.toFixed(4) + ", pitch: " + coords.pitch.toFixed(4), "color: #ff7800; font-weight: bold; font-size: 14px;");
      }
    }
  });

  // Display the initial scene.
  switchScene(scenes[0]);

})();
