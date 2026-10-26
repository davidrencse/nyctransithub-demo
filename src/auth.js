// Firebase Authentication when configured; a browser-only demo otherwise.

import { firebaseConfig } from '../firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const usingFirebase = Boolean(firebaseConfig.apiKey);

let fb = null;
let notify = () => {};

const FIREBASE_ERRORS = {
  'auth/invalid-email': 'That email address isn’t valid.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account uses that email. Create one instead.',
  'auth/email-already-in-use': 'An account already uses that email. Sign in instead.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/popup-closed-by-user': 'The Google window closed before sign-in finished.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
};

function friendly(err) {
  return new Error(FIREBASE_ERRORS[err.code] || err.message || 'Sign-in failed. Try again.');
}

const toUser = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName || u.email } : null);

export async function initAuth(onChange) {
  notify = onChange;
  if (usingFirebase) {
    const [{ initializeApp }, mod] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]);
    const auth = mod.getAuth(initializeApp(firebaseConfig));
    fb = { auth, mod };
    mod.onAuthStateChanged(auth, (u) => notify(toUser(u)));
    return;
  }
  notify(readDemo('th.demoUser'));
}

// ---- demo mode: a hashed password per email in localStorage
function readDemo(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeDemo(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function validate(email, password) {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(FIREBASE_ERRORS['auth/invalid-email']);
  if (password.length < 6) throw new Error(FIREBASE_ERRORS['auth/weak-password']);
}

export async function signIn(email, password) {
  if (fb) {
    try { await fb.mod.signInWithEmailAndPassword(fb.auth, email, password); } catch (e) { throw friendly(e); }
    return;
  }
  validate(email, password);
  const accounts = readDemo('th.demoAccounts') || {};
  if (!accounts[email]) throw new Error(FIREBASE_ERRORS['auth/user-not-found']);
  if (accounts[email] !== (await hash(email + password))) throw new Error(FIREBASE_ERRORS['auth/invalid-credential']);
  const user = { uid: 'demo-' + (await hash(email)).slice(0, 12), email, name: email };
  writeDemo('th.demoUser', user);
  notify(user);
}

export async function signUp(email, password) {
  if (fb) {
    try { await fb.mod.createUserWithEmailAndPassword(fb.auth, email, password); } catch (e) { throw friendly(e); }
    return;
  }
  validate(email, password);
  const accounts = readDemo('th.demoAccounts') || {};
  if (accounts[email]) throw new Error(FIREBASE_ERRORS['auth/email-already-in-use']);
  accounts[email] = await hash(email + password);
  writeDemo('th.demoAccounts', accounts);
  await signIn(email, password);
}

export async function signInWithGoogle() {
  if (!fb) throw new Error('Google sign-in needs Firebase. Add your config to firebase-config.js.');
  try { await fb.mod.signInWithPopup(fb.auth, new fb.mod.GoogleAuthProvider()); } catch (e) { throw friendly(e); }
}

export async function signOut() {
  if (fb) return fb.mod.signOut(fb.auth);
  writeDemo('th.demoUser', null);
  notify(null);
}
