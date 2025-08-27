var PdfFlip = {
    // Modo revista activo/desactivado
    magazineMode: true,
    // Escala anterior (para restaurar)
    oldScale: 1,
    // Página actual mostrada
    currentPage: 1,
    // Escala actual de visualización
    currentScale: 1,
    // Diseño de visualización: 'single' (página simple) o 'double' (doble página)
    layout: 'double',
    // Escala máxima permitida para zoom
    maxScale: 2,
    // Ruta del archivo de sonido para efecto de voltear página
    audioSrc: "sound/page-flip.mp3",

    // Función de inicialización principal
    init: function () {
        // Manejar eventos de teclado para navegación
        $(window).bind('keydown', function (e) {
            console.log(e.keyCode);
            // Evitar conflicto con campos de entrada
            if (e.target && e.target.tagName.toLowerCase() != 'input') {
                // Flecha izquierda (37) o arriba (38): página anterior
                if (e.keyCode == 37 || e.keyCode == 38) {
                    $('.directions .prev-button').click();
                }
                // Flecha derecha (39) o abajo (40): página siguiente
                else if (e.keyCode == 39 || e.keyCode == 40) {
                    $('.directions .next-button').click();
                }
            }
        });

        // Ir a la primera página
        $(document).on('click','#firstPage',function(){
            $("#magazine").turn('page', 1);
        });

        // Ir a la última página
        $(document).on('click','#lastPage',function(){
            $("#magazine").turn('page', PDFViewerApplication.pagesCount);
        });

        // Manejar cambio de página desde la vista de miniaturas
        $(document).on('click','#thumbnailView a',function(){
          $('.toolbar .pageNumber').trigger('change');
        });

        // Cambiar página desde el selector numérico
        $(document).on('change', '.toolbar .pageNumber', function (e) {
            $("#magazine").turn('page', $(this).val());
        });

        // Navegar a página anterior (botones toolbar y direccionales)
        $(document).on('click', '.toolbar #previous , .directions .prev-button', function (e) {
            $("#magazine").turn('previous');
            return false; // Prevenir comportamiento por defecto
        });

        // Navegar a página siguiente (botones toolbar y direccionales)
        $(document).on('click', '.toolbar #next, .directions .next-button', function (e) {
            $("#magazine").turn('next');
            return false; // Prevenir comportamiento por defecto
        });

        // Esperar a que las páginas del PDF estén cargadas antes de iniciar modo revista
        document.addEventListener("pagesloaded", PdfFlip.launchMagazineMode, true);
    },

    // Función para lanzar el modo revista una vez cargadas las páginas
    launchMagazineMode: function (e) {
        // Remover el event listener para evitar múltiples ejecuciones
        document.removeEventListener("pagesloaded", PdfFlip.launchMagazineMode, true);
        // Iniciar el modo revista
        PdfFlip.start();
    },

    // Función principal que configura y muestra la revista digital
    start: function () {
        // Deshabilitar Web Workers (posiblemente para compatibilidad)
        PDFViewerApplication.disableWorker = true;

        // Activar modo revista
        PdfFlip.magazineMode = true;
        // Guardar escala actual para posible restauración
        PdfFlip.oldScale = PDFViewerApplication.pdfViewer.currentScale;
        // Ajustar escala para que la página encaje en la vista
        PDFViewerApplication.pdfViewer.currentScaleValue = 'page-fit';

        // Crear contenedor para la revista y botones de navegación
        $('#viewerContainer').after('<div id="magazineContainer"><div id="magazine"></div></div>');
        $('body').append('<div class="directions"><a href="#" class="prev-button"></a><a href="#" class="next-button"></a></div>')

        // Ocultar visor PDF original y mostrar revista
        $("#viewerContainer").hide();
        $("#viewer").hide();
        $(".se-pre-con").hide(); // Ocultar posible preloader
        $("#magazine").show();

        // Establecer página actual
        PdfFlip.currentPage = PDFViewerApplication.page;

        // Array de páginas a cargar inicialmente (solo primera página)
        var pages = [1];

        // Cargar páginas iniciales y luego inicializar el flipbook
        PdfFlip.loadTurnJsPages(pages, $('#magazine'), true, true).then(function () {
            // Inicializar el plugin turn.js para efecto de página volteable
            $("#magazine").turn({
                autoCenter: true,           // Centrar automáticamente
                display: 'single',          // Visualización inicial: página simple
                width: $("#viewer .canvasWrapper canvas")[0].width,    // Ancho basado en el canvas original
                height: $("#viewer .canvasWrapper canvas")[0].height,  // Alto basado en el canvas original
                pages: PDFViewerApplication.pdfDocument.numPages, // Número total de páginas
                page: 1,                    // Empezar en página 1
                elevation: 100,             // Elevación/curvatura de la página
                duration: 600,              // Duración de la animación
                acceleration: !PdfFlip.isChrome(), // Aceleración (desactivada para Chrome)
                when: {
                    // Evento cuando se necesita una página que no está cargada
                    missing: function (event, pages) {
                        PdfFlip.loadTurnJsPages(pages, this, false, false);
                    },
                    // Evento cuando se está volteando una página
                    turning: function (event, page, view) {
                        // Si la página solicitada no está cargada
                        if (!$('#magazine').turn('hasPage', page)) {
                            // Cargar la página y luego ir a ella
                            PdfFlip.loadTurnJsPages([page], this, false, true).then(function () {
                                $('#magazine').turn('page', page);
                            });
                            // Prevenir el volteo hasta que la página esté cargada
                            event.preventDefault();
                        }
                        // Reproducir sonido de voltear página
                        PdfFlip.startTurnSound();
                        // Actualizar página actual
                        PdfFlip.currentPage = page;
                        PDFViewerApplication.page = page;
                    },
                    // Evento cuando se completó el volteo de página
                    turned: function(event, page, view){
                        // Podría agregarse funcionalidad aquí
                    }
                }
            });

            // Pequeño delay para asegurar que todo esté inicializado
            setTimeout(function () {
                // Establecer el diseño (simple o doble página)
                $("#magazine").turn("display", PdfFlip.layout);

                // Multiplicador para tamaño según diseño
                var multiplier = PdfFlip.layout == 'double' ? 2 : 1;

                // Ajustar tamaño del flipbook
                $("#magazine").turn("size",
                    $("#magazine canvas")[0].width * multiplier,
                    $("#magazine canvas")[0].height);

                // Si no estamos en la primera página, ir a la página actual
                if (PdfFlip.currentPage > 1)
                    $("#magazine").turn("page", PdfFlip.currentPage);

                // Configurar funcionalidad de zoom
                $("#magazineContainer").zoom({
                    max: PdfFlip.maxScale,   // Escala máxima
                    flipbook: $('#magazine'), // Elemento a aplicar zoom
                    when: {
                        // Al hacer tap (toque/clic)
                        tap: function (event) {
                            // Si está en escala normal, hacer zoom in
                            if ($(this).zoom('value') == 1) {
                                $('#magazine').
                                    removeClass('animated').
                                    addClass('zoom-in');
                                $(this).zoom('zoomIn', event);
                            } else {
                                // Si ya está ampliado, hacer zoom out
                                $(this).zoom('zoomOut');
                            }
                        },
                        // Al redimensionar (cambiar escala)
                        resize: function (event, scale, page, pageElement) {
                            PdfFlip.currentScale = scale;
                            // Recargar páginas con la nueva escala
                            PdfFlip.loadTurnJsPages($('#magazine').turn('view'), $('#magazine'), false, false);
                        },
                        // Al hacer zoom in
                        zoomIn: function () {
                            $('.zoom-icon').removeClass('zoom-icon-in').addClass('zoom-icon-out');
                            $('#magazine').addClass('zoom-in');
                            PdfFlip.resizeViewport();
                        },
                        // Al hacer zoom out
                        zoomOut: function () {
                            $('.zoom-icon').removeClass('zoom-icon-out').addClass('zoom-icon-in');
                            setTimeout(function () {
                                $('#magazine').addClass('animated').removeClass('zoom-in');
                                PdfFlip.resizeViewport();
                            }, 0);
                        },
                        // Deslizar izquierda: página siguiente
                        swipeLeft: function () {
                            $('#magazine').turn('next');
                        },
                        // Deslizar derecha: página anterior
                        swipeRight: function () {
                            $('#magazine').turn('previous');
                        }
                    }
                });

                // Manejar clic en iconos de zoom
                $('.zoom-icon').bind('click', function () {
                    if ($(this).hasClass('zoom-icon-in'))
                        $('#magazineContainer').zoom('zoomIn');
                    else if ($(this).hasClass('zoom-icon-out'))
                        $('#magazineContainer').zoom('zoomOut');
                });
            }, 10); // Pequeño delay de 10ms
        });
    },

    // Redimensionar viewport según zoom y tamaño de ventana
    resizeViewport: function () {
        var width = $(window).width(),
            height = $(window).height(),
            options = $('#magazine').turn('options');

        $('#magazine').removeClass('animated');

        // Ajustar tamaño del contenedor
        $('#magazineContainer').css({
            width: width,
            height: height - $('.toolbar').height()
        }).zoom('resize');

        // Si el zoom está al máximo (2x)
        if ($('#magazine').turn('zoom') == 2) {
            // Calcular dimensiones limitadas para el viewport
            var bound = PdfFlip.calculateBound({
                width: options.width,
                height: options.height,
                boundWidth: Math.min(options.width, width),
                boundHeight: Math.min(options.height, height)
            });

            // Asegurar que el ancho sea par (posiblemente para evitar problemas de renderizado)
            if (bound.width % 2 !== 0)
                bound.width -= 1;

            // Si las dimensiones cambiaron, ajustar tamaño
            if (bound.width != $('#magazine').width() || bound.height != $('#magazine').height()) {
                $('#magazine').turn('size', bound.width, bound.height);

                // Si estamos en la primera página, mostrar efecto de "pellizco" en esquina inferior derecha
                if ($('#magazine').turn('page') == 1)
                    $('#magazine').turn('peel', 'br');
            }

            // Centrar la revista en la vista
            $('#magazine').css({top: -bound.height / 2, left: -bound.width / 2});
        }

        $('#magazine').addClass('animated');
    },

    // Calcular dimensiones limitadas manteniendo relación de aspecto
    calculateBound: function (d) {
        var bound = {width: d.width, height: d.height};

        // Si las dimensiones exceden los límites
        if (bound.width > d.boundWidth || bound.height > d.boundHeight) {
            var rel = bound.width / bound.height; // Relación de aspecto

            // Calcular nuevas dimensiones manteniendo la relación de aspecto
            if (d.boundWidth / rel > d.boundHeight && d.boundHeight * rel <= d.boundWidth) {
                bound.width = Math.round(d.boundHeight * rel);
                bound.height = d.boundHeight;
            } else {
                bound.width = d.boundWidth;
                bound.height = Math.round(d.boundWidth / rel);
            }
        }

        return bound;
    },

    // Calcular total de páginas (posiblemente no usado)
    calculateTotalPages: function () {
        return $('#viewer .page').length;
    },

    // Reproducir sonido de voltear página
    startTurnSound: function () {
        var audio = new Audio(PdfFlip.audioSrc);
        audio.play();
    },

    // Cargar páginas y convertirlas en canvas para el flipbook
    loadTurnJsPages: function (pages, magazine, isInit, defer, scale) {
        var deferred = null;

        // Si se solicita, crear objeto diferido para promises
        if (defer)
            deferred = $.Deferred();

        var pagesRendered = 0;
        // Procesar cada página solicitada
        for (var i = 0; i < pages.length; i++) {
            PDFViewerApplication.pdfDocument.getPage(pages[i]).then(function (page) {
                // Crear canvas para renderizar la página
                var destinationCanvas = document.createElement('canvas');

                // Obtener viewport sin escalar y calcular escala apropiada
                var unscaledViewport = page.getViewport(1);
                var divider = PdfFlip.layout == 'double' ? 2 : 1;

                // Calcular escala para que quepa en el contenedor
                var scale = Math.min((($('#mainContainer').height() - 20) / unscaledViewport.height), 
                                    ((($('#mainContainer').width() - 80) / divider) / unscaledViewport.width));

                // Obtener viewport con la escala calculada
                var viewport = page.getViewport(scale);

                // Si hay una escala actual mayor, usarla
                if (PdfFlip.currentScale > 1)
                    viewport = page.getViewport(PdfFlip.currentScale);

                // Dimensionar el canvas (con pequeño margen porcentual comentado)
                destinationCanvas.height = viewport.height; // - ((viewport.height / 100) * 10);
                destinationCanvas.width = viewport.width; // - ((viewport.width / 100) * 10);

                // Contexto de renderizado
                var renderContext = {
                    canvasContext: destinationCanvas.getContext("2d"),
                    viewport: viewport
                };

                // Renderizar la página en el canvas
                page.render(renderContext).promise.then(function () {
                    pagesRendered++;

                    // Establecer atributos de identificación
                    destinationCanvas.setAttribute('data-page-number', page.pageNumber);
                    destinationCanvas.id = 'magCanvas' + page.pageNumber;

                    // Si no es inicialización
                    if (!isInit) {
                        // Si la página ya existe, actualizar su contenido
                        if ($(magazine).turn('hasPage', page.pageNumber)) {
                            var oldCanvas = $('#magCanvas' + page.pageNumber)[0];
                            oldCanvas.width = destinationCanvas.width;
                            oldCanvas.height = destinationCanvas.height;

                            var oldCtx = oldCanvas.getContext("2d");
                            oldCtx.drawImage(destinationCanvas, 0, 0);
                        }
                        else {
                            // Si no existe, añadirla al flipbook
                            $(magazine).turn('addPage', $(destinationCanvas), page.pageNumber);
                        }
                    }
                    else {
                        // En inicialización, simplemente añadir al contenedor
                        $("#magazine").append($(destinationCanvas));
                    }

                    // Si todas las páginas fueron renderizadas, resolver la promise
                    if (pagesRendered == pages.length)
                        if (deferred)
                            deferred.resolve();
                });
            });
        }

        // Devolver la promise si se solicitó
        if (deferred)
            return deferred;
    },

    // Detectar si el navegador es Chrome
    isChrome: function () {
        return navigator.userAgent.indexOf('Chrome') != -1;
    }
};