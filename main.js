// ==========================================================
// THEME SWITCHER LOGIC
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }
    themeToggle.addEventListener('change', function () {
        if (this.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    });
});


// ==========================================================
// JQUERY-BASED CHESS LOGIC (COMPLETE & CORRECTED)
// ==========================================================
$(document).ready(function () {
    // --- CORE VARIABLES ---
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const API_BASE_URL = 'http://127.0.0.1:5001';
    var board = null;
    var plyCount = 0;
    var fenElement = $('#fen-input');
    var statusElement = $('#status');
    var overlay = $('#fullscreen-overlay');
    var dragCounter = 0;
    var moveHistory = [];
    var historyIndex = -1;
    var arrowCanvas = null;

    function clearHighlights() {
        $('#myBoard .square-55d63').removeClass('highlight-check highlight-checkmate');
    }

    function triggerPieceAnimation() {
        const boardEl = $('#myBoard');
        boardEl.removeClass('has-animated');
        setTimeout(() => {
            boardEl.addClass('has-animated');
        }, 50);
    }

    function loadPosition(fen, animate) {
        board.position(fen);
        fenElement.val(board.fen());
        updateTurnRadio(board.fen());
        if (animate) {
            triggerPieceAnimation();
        }
    }

    function getCurrentTurn() {
        return $('input[name="turn"]:checked').val();
    }

    function updateTurnInFen(fen, turn) {
        const parts = fen.split(' ');
        const piecePlacement = parts[0];
        return `${piecePlacement} ${turn} KQkq - 0 1`;
    }

    function updateTurnRadio(fen) {
        const turn = fen.split(' ')[1] || 'w';
        $(`input[name="turn"][value="${turn}"]`).prop('checked', true);
    }

    function saveToHistory(fen, plyCount, move) {
        moveHistory = moveHistory.slice(0, historyIndex + 1);
        moveHistory.push({ fen, plyCount, move });
        historyIndex = moveHistory.length - 1;
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        $('#undo-btn').prop('disabled', historyIndex <= 0);
        $('#redo-btn').prop('disabled', historyIndex >= moveHistory.length - 1);
    }

    function initArrowCanvas() {
        if (!arrowCanvas) {
            arrowCanvas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            arrowCanvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";
            document.getElementById('myBoard').appendChild(arrowCanvas);
        }
    }

    function drawMoveArrow(source, target) {
        initArrowCanvas();
        $(arrowCanvas).empty();
        const squareSize = $('.square-55d63').width();
        const fileToX = file => (file.charCodeAt(0) - 'a'.charCodeAt(0)) * squareSize + squareSize / 2;
        const rankToY = rank => (8 - parseInt(rank)) * squareSize + squareSize / 2;
        const sourceX = fileToX(source[0]);
        const sourceY = rankToY(source[1]);
        const targetX = fileToX(target[0]);
        const targetY = rankToY(target[1]);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "arrow-line");
        line.setAttribute("x1", sourceX); line.setAttribute("y1", sourceY);
        line.setAttribute("x2", targetX); line.setAttribute("y2", targetY);
        arrowCanvas.appendChild(line);
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
        const headSize = 12;
        const headX = targetX - Math.cos(angle) * headSize;
        const headY = targetY - Math.sin(angle) * headSize;
        const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        head.setAttribute("class", "arrow-head");
        head.setAttribute("points", `${headX},${headY} ` + `${headX - headSize * Math.cos(angle - Math.PI / 6)},${headY - headSize * Math.sin(angle - Math.PI / 6)} ` + `${headX - headSize * Math.cos(angle + Math.PI / 6)},${headY - headSize * Math.sin(angle + Math.PI / 6)}`);
        arrowCanvas.appendChild(head);
        setTimeout(() => { $(arrowCanvas).empty(); }, 1000);
    }

    function onDrop(source, target) {
        $('#myBoard').removeClass('has-animated');
        clearHighlights();

        const currentFen = board.fen();
        const currentTurn = getCurrentTurn();
        const fenWithTurn = updateTurnInFen(currentFen, currentTurn);

        $.ajax({
            url: API_BASE_URL + '/move', type: 'POST', contentType: 'application/json',
            data: JSON.stringify({ fen: fenWithTurn, move: source + target, ply_count: plyCount }),
            success: function (response) {
                if (response.error) {
                    statusElement.html('<span style="color:red;">' + response.error + '</span>');
                    return 'snapback';
                }
                board.position(response.fen, false);
                plyCount = response.ply_count;
                fenElement.val(response.fen);
                updateTurnRadio(response.fen);
                saveToHistory(response.fen, response.ply_count, source + target);
                statusElement.text(response.status);

                if (response.king_square) {
                    const highlightClass = response.is_checkmate ? 'highlight-checkmate' : 'highlight-check';
                    $('#myBoard [data-square="' + response.king_square + '"]').addClass(highlightClass);
                }
            },
            error: function (xhr) {
                let errorMsg = 'Move rejected by server!';
                if (xhr.responseJSON && xhr.responseJSON.status) errorMsg = xhr.responseJSON.status;
                statusElement.html('<span style="color:red;">' + errorMsg + '</span>');
                return 'snapback';
            }
        });
    }

    $('#undo-btn').on('click', function () {
        clearHighlights();
        if (historyIndex > 0) {
            historyIndex--;
            const state = moveHistory[historyIndex];
            loadPosition(state.fen, false);
            plyCount = state.plyCount;
            statusElement.text('Undo performed.');
            updateHistoryButtons();
        }
    });

    $('#redo-btn').on('click', function () {
        clearHighlights();
        if (historyIndex < moveHistory.length - 1) {
            historyIndex++;
            const state = moveHistory[historyIndex];
            if (state.move) { drawMoveArrow(state.move.substring(0, 2), state.move.substring(2, 4)); }
            setTimeout(() => {
                loadPosition(state.fen, false);
                plyCount = state.plyCount;
                statusElement.text('Redo performed.');
                updateHistoryButtons();
            }, 300);
        }
    });

    $(window).on('dragenter', function (e) { e.preventDefault(); e.stopPropagation(); dragCounter++; overlay.removeClass('hidden'); });
    $(window).on('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); dragCounter--; if (dragCounter === 0) { overlay.addClass('hidden'); } });
    $(window).on('dragover', function (e) { e.preventDefault(); e.stopPropagation(); });
    $(window).on('drop', function (e) {
        e.preventDefault(); e.stopPropagation(); dragCounter = 0; overlay.addClass('hidden');
        clearHighlights();
        var files = e.originalEvent.dataTransfer.files;
        if (files.length > 0 && files[0].type.match('image.*')) {
            var formData = new FormData();
            formData.append('image', files[0]);
            statusElement.text('Analyzing screenshot...');
            $.ajax({
                url: API_BASE_URL + '/upload_image', type: 'POST', data: formData, processData: false, contentType: false,
                success: function (response) {
                    if (response.fen) {
                        board.orientation(response.orientation);
                        board.position(response.fen);
                        fenElement.val(board.fen());
                        updateTurnRadio(board.fen());
                        triggerPieceAnimation();
                        plyCount = 0;
                        moveHistory = [{ fen: board.fen(), plyCount: 0 }];
                        historyIndex = 0;
                        updateHistoryButtons();
                        statusElement.html('Board updated. <strong>Please verify the turn to move.</strong>');
                    } else if (response.error) {
                        statusElement.html('<span style="color:red;">' + response.error + '</span>');
                    }
                },
                error: function () { statusElement.html('<span style="color:red;">Error uploading image.</span>'); }
            });
        } else {
            statusElement.html('<span style="color:red;">Please drop an image file.</span>');
        }
    });

    $('#fen-input').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            clearHighlights();
            board.orientation('white');
            const fenStr = $(this).val();
            plyCount = 0;
            moveHistory = [{ fen: fenStr, plyCount: 0 }];
            historyIndex = 0;
            updateHistoryButtons();
            loadPosition(fenStr, true);
            statusElement.text('Board updated from FEN.');
        }
    });

    // ✅ ========================================================================
    // ✅ CORRECTED BUTTON HANDLERS
    // ✅ ========================================================================

    $('#best-move-btn').on('click', function () {
        clearHighlights();
        statusElement.text('Simulating 6-move variant...');
        const fenWithTurn = updateTurnInFen(board.fen(), getCurrentTurn());
        $.ajax({
            url: API_BASE_URL + '/suggest_variant_move',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ fen: fenWithTurn, ply_count: plyCount }),
            success: function (response) {
                // ✅ FIX: Always construct the clickable move string when a move is returned.
                if (response.best_move) {
                    const clickableMove = `<span class="clickable-move" data-move="${response.best_move}">${response.best_move}</span>`;
                    statusElement.html(`Variant Best Move: ${clickableMove} (Score: ${response.score / 100.0})`);
                    drawMoveArrow(response.best_move.substring(0, 2), response.best_move.substring(2, 4));
                } else if (response.message) {
                    statusElement.text(response.message);
                } else if (response.error) {
                    statusElement.html('<span style="color:red;">' + response.error + '</span>');
                }
            },
            error: function (xhr) {
                statusElement.html('<span style="color:red;">Variant suggestion failed. See server console.</span>');
            }
        });
    });

    $('#checkmate-btn').on('click', function () {
        clearHighlights();
        statusElement.text('Finding standard checkmate...');
        const fenWithTurn = updateTurnInFen(board.fen(), getCurrentTurn());
        $.ajax({
            url: API_BASE_URL + '/find_mate',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ fen: fenWithTurn }),
            success: function (response) {
                if (response.mating_move && response.mate_in) {
                    const clickableMove = `<span class="clickable-move" data-move="${response.mating_move}">${response.mating_move}</span>`;
                    statusElement.html(`Mate in ${response.mate_in} found! Move: ${clickableMove}`);
                    drawMoveArrow(response.mating_move.substring(0, 2), response.mating_move.substring(2, 4));
                } else if (response.message) {
                    statusElement.text(response.message);
                } else if (response.error) {
                    statusElement.html('<span style="color:red;">' + response.error + '</span>');
                }
            },
            error: function (xhr) { statusElement.html('<span style="color:red;">Server communication error.</span>'); }
        });
    });

    $('.info-container').on('click', '.clickable-move', function () {
        const uciMove = $(this).data('move');
        drawMoveArrow(uciMove.substring(0, 2), uciMove.substring(2, 4));
        setTimeout(() => { onDrop(uciMove.substring(0, 2), uciMove.substring(2, 4)); }, 200);
    });

    $('#copy-fen-btn').on('click', function () {
        var fenText = fenElement.val();
        navigator.clipboard.writeText(fenText).then(() => {
            statusElement.text('FEN copied to clipboard!');
        }, () => {
            statusElement.html('<span style="color:red;">Failed to copy FEN.</span>');
        });
    });

    var config = {
        draggable: true,
        position: 'start',
        pieceTheme: 'img/{piece}.png',
        onDrop: onDrop,
        onSnapEnd: () => { $('#myBoard').removeClass('has-animated'); }
    };
    board = Chessboard('myBoard', config);
    loadPosition(startFen, true);
    saveToHistory(startFen, 0);

    const commandPaletteOverlay = $('#command-palette-overlay');
    const commandInput = $('#command-input');
    const commandList = $('#command-list');
    const commands = [
        { name: 'Suggest Variant Best Move', action: () => $('#best-move-btn').click(), shortcut: 'B' },
        { name: 'Find Standard Checkmate', action: () => $('#checkmate-btn').click(), shortcut: 'M' },
        { name: 'Undo Last Move', action: () => $('#undo-btn').click(), shortcut: 'U' },
        { name: 'Redo Move', action: () => $('#redo-btn').click(), shortcut: 'R' },
        { name: 'Copy FEN', action: () => $('#copy-fen-btn').click(), shortcut: 'C' },
        { name: 'Toggle Theme', action: () => $('#theme-toggle').click(), shortcut: 'T' },
    ];

    function renderCommands(filter = '') {
        commandList.empty();
        const filteredCommands = commands.filter(cmd => cmd.name.toLowerCase().includes(filter.toLowerCase()));
        filteredCommands.forEach((cmd, index) => {
            const li = $(`<li>${cmd.name} <kbd>${cmd.shortcut}</kbd></li>`);
            li.on('click', () => { cmd.action(); closeCommandPalette(); });
            if (index === 0) { li.addClass('selected'); }
            commandList.append(li);
        });
    }

    function openCommandPalette() {
        commandPaletteOverlay.removeClass('hidden');
        commandInput.focus().select();
        renderCommands();
    }

    function closeCommandPalette() {
        commandPaletteOverlay.addClass('hidden');
        commandInput.val('');
    }

    $('#command-palette-btn').on('click', openCommandPalette);
    commandPaletteOverlay.on('click', function (e) { if (e.target === this) { closeCommandPalette(); } });
    $(document).on('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
        if (e.key === 'Escape' && !commandPaletteOverlay.hasClass('hidden')) { closeCommandPalette(); }
    });
    commandInput.on('input', () => renderCommands(commandInput.val()));
});
