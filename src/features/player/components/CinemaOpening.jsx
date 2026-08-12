import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export function CinemaOpening({ scheduledStartAt }) {
  const reduceMotion = useReducedMotion();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((new Date(scheduledStartAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const update = () => setRemaining(
      Math.max(0, Math.ceil((new Date(scheduledStartAt).getTime() - Date.now()) / 1000)),
    );
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [scheduledStartAt]);

  const gentle = reduceMotion ? { duration: 0 } : { duration: 1.2, ease: [0.22, 1, 0.36, 1] };
  return (
    <section className="wm-cinema-opening" aria-label="Seenetrica feature presentation">
      <motion.div
        className="wm-opening-curtain is-left"
        initial={{ x: 0 }}
        animate={{ x: reduceMotion ? 0 : "-82%" }}
        transition={{ duration: reduceMotion ? 0 : 4, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        className="wm-opening-curtain is-right"
        initial={{ x: 0 }}
        animate={{ x: reduceMotion ? 0 : "82%" }}
        transition={{ duration: reduceMotion ? 0 : 4, ease: [0.76, 0, 0.24, 1] }}
      />
      <div className="wm-opening-grain" aria-hidden="true" />
      <motion.div
        className="wm-opening-frame"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...gentle, delay: reduceMotion ? 0 : 2.4 }}
      >
        <motion.img
          src="/assets/favicon.svg"
          alt=""
          aria-hidden="true"
          initial={{ opacity: 0, rotate: reduceMotion ? 0 : -8 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ ...gentle, delay: reduceMotion ? 0 : 3.2 }}
        />
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.28em" }}
          animate={{ opacity: 1, letterSpacing: "0.48em" }}
          transition={{ ...gentle, delay: reduceMotion ? 0 : 4 }}
        >
          Seenetrica private cinema
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: reduceMotion ? 0 : 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...gentle, delay: reduceMotion ? 0 : 5.2 }}
        >
          Feature <em>Presentation</em>
        </motion.h1>
        <motion.span
          className="wm-opening-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduceMotion ? 0 : 2, delay: reduceMotion ? 0 : 6.1 }}
        />
        <motion.div
          className="wm-opening-final-count"
          initial={{ opacity: 0 }}
          animate={{ opacity: remaining <= 6 ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
          aria-live="off"
        >
          <span>Picture begins in</span>
          <strong>{remaining}</strong>
        </motion.div>
      </motion.div>
      <div className="wm-opening-progress" aria-hidden="true">
        <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: Math.max(0.1, remaining), ease: "linear" }} />
      </div>
    </section>
  );
}
