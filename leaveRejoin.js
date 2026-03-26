function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

function setupLeaveRejoin(bot, createBot) {
    // Timers
    let leaveTimer = null
    let jumpTimer = null
    let jumpOffTimer = null
    let reconnectTimer = null

    // State
    let stopped = false
    let reconnectAttempts = 0
    let lastLogAt = 0

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now()
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now
            console.log(msg)
        }
    }

    function cleanup() {
        stopped = true
        if (leaveTimer) clearTimeout(leaveTimer)
        if (jumpTimer) clearTimeout(jumpTimer)
        if (jumpOffTimer) clearTimeout(jumpOffTimer)
        if (reconnectTimer) clearTimeout(reconnectTimer)
        leaveTimer = jumpTimer = jumpOffTimer = reconnectTimer = null
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return

        bot.setControlState('jump', true)
        jumpOffTimer = setTimeout(() => {
            bot.setControlState('jump', false)
        }, 300)

        // random jump 20s -> 5m
        const nextJump = randomMs(20000, 5 * 60 * 1000)
        jumpTimer = setTimeout(scheduleNextJump, nextJump)
    }

    function scheduleReconnect(reason = 'end') {
        // Disabling duplicate reconnect logic.
        // index.js handles reconnection via the 'end' event.
        logThrottled(`[AFK] Connection ended (\${reason}). Main process will handle rejoin.`);
    }

    bot.once('spawn', () => {
        // reset attempt counter on successful connect
        reconnectAttempts = 0

        // clear any old timers
        cleanup()
        stopped = false

        // Stay connected: 10 minutes -> 30 minutes (Human-like behavior)
        const stayTime = randomMs(600000, 1800000)

        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`)

        scheduleNextJump()

        leaveTimer = setTimeout(() => {
            if (stopped) return
            logThrottled('[AFK] Leaving server (timer)')
            cleanup()
            try {
                bot.quit()
            } catch (e) {
                // ignore if already closed
            }
        }, stayTime)
    })

    // When the connection ends for ANY reason, just clean up our timers.
    // Reconnection is handled by index.js — no duplicate reconnect here.
    bot.on('end', () => {
        cleanup()
    })

    bot.on('kicked', () => {
        cleanup()
    })

    bot.on('error', () => {
        cleanup()
    })
}

module.exports = setupLeaveRejoin
