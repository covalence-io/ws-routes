(function () {
    let ws: WebSocketExt;
    const HEARTBEAT_TIMEOUT = ((1000 * 5) + (1000 * 1)); // 5 + 1 second
    const HEARTBEAT_VALUE = 1;
    const messages = <HTMLElement>document.getElementById('messages');
    const wsOpen = <HTMLButtonElement>document.getElementById('ws-open');
    const wsTkOpen = <HTMLButtonElement>document.getElementById('ws-tk-open');
    const wsThreadOpen = <HTMLButtonElement>document.getElementById('ws-thread-open');
    const wsClose = <HTMLButtonElement>document.getElementById('ws-close');
    const login = <HTMLButtonElement>document.getElementById('login');
    const logout = <HTMLButtonElement>document.getElementById('logout');
    const wsSend = <HTMLButtonElement>document.getElementById('ws-send');
    const wsInput = <HTMLInputElement>document.getElementById('ws-input');
    const wsThreadInput = <HTMLInputElement>document.getElementById('ws-thread-input');

    function showMessage(message: string) {
        if (!messages) {
            return;
        }

        messages.textContent += `\n${message}`;
        messages.scrollTop = messages?.scrollHeight;
    }

    function closeConnection() {
        if (!!ws) {
            ws.close();
        }
    }

    function heartbeat() {
        if (!ws) {
            return;
        } else if (!!ws.pingTimeout) {
            clearTimeout(ws.pingTimeout);
        }

        ws.pingTimeout = setTimeout(() => {
            ws.close();

            // business logic for deciding whether or not to reconnect
        }, HEARTBEAT_TIMEOUT);

        const data = new Uint8Array(1);

        data[0] = HEARTBEAT_VALUE;

        ws.send(data);
    }

    function isBinary(obj: any) {
        return typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Blob]';
    }

    function initConnection(tk?: string, threadid?: string) {
        return () => {
            closeConnection();

            ws = new WebSocket(`ws://localhost:3000${!threadid ? '': `/thread/${threadid}`}${!tk ? '' : `/?at=${tk}`}`) as WebSocketExt;

            ws.addEventListener('error', () => {
                showMessage('WebSocket error');
            });

            ws.addEventListener('open', () => {
                showMessage(`WebSocket connection established${!threadid ? '' : ` for thread id ${threadid}`}`);
            });

            ws.addEventListener('close', () => {
                showMessage(`WebSocket connection closed${!threadid ? '' : ` for thread id ${threadid}`}`);

                if (!!ws.pingTimeout) {
                    clearTimeout(ws.pingTimeout);
                }
            });

            ws.addEventListener('message', (msg: MessageEvent<string>) => {
                if (isBinary(msg.data)) {
                    heartbeat();
                } else {
                    showMessage(`Received message: ${msg.data}`);
                }
            });
        };
    }

    wsOpen.addEventListener('click', initConnection());
    wsTkOpen.addEventListener('click', initConnection('test'));
    wsThreadOpen.addEventListener('click', () => {
        const threadid = wsThreadInput.value;

        if (!threadid) {
            showMessage('Please provide a thread ID');
            return;
        }

        initConnection('test', threadid)();

        wsThreadInput.value = '';
    });

    wsClose.addEventListener('click', closeConnection);

    wsSend.addEventListener('click', () => {
        const val = wsInput?.value;

        if (!val) {
            return;
        } else if (!ws || ws.readyState !== WebSocket.OPEN) {
            showMessage('No WebSocket connection');
            return;
        }

        ws.send(val);
        showMessage(`Sent "${val}"`);
        wsInput.value = '';
    });

    login.addEventListener('click', async () => {
        const res = await fetch('/api/v1/users/login');

        if (res.ok) {
            showMessage('Logged in');
        } else {
            showMessage('Log in error');
        }
    });

    logout.addEventListener('click', async () => {
        closeConnection();

        const res = await fetch('/api/v1/users/logout');

        if (res.ok) {
            showMessage('Logged out');
        } else {
            showMessage('Log out error');
        }
    });
})();