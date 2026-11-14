import { useMemo, useState, type FormEvent } from 'react';
import { butlerService, type ButlerDraftAction, type ButlerChatResponse } from '../../services/butlerService';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  draftAction?: ButlerDraftAction;
}

export default function ButlerChatPanel({
  restaurantId,
  open,
  onClose,
}: {
  restaurantId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello. I can help with menu discovery, menu drafting, and restaurant questions for your active restaurant.',
    },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const hasConversation = useMemo(() => Boolean(conversationId), [conversationId]);

  const addMessage = (role: ChatRole, text: string, draftAction?: ButlerDraftAction) => {
    setMessages((current) => [...current, { id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, role, text, draftAction }]);
  };

  const handleSend = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError('');
    addMessage('user', trimmed);
    setInput('');

    try {
      const response = await butlerService.send({ message: trimmed, conversationId, restaurantId });
      setConversationId(response.conversationId || conversationId);
      if (response.error) {
        setError(response.error.message);
      }
      if (response.reply) {
        addMessage('assistant', response.reply, response.draftAction);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Butler could not respond right now.';
      setError(message);
      addMessage('assistant', 'I could not complete that request. Please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const handleDraftConfirmation = async (draftAction: ButlerDraftAction, confirmed: boolean) => {
    if (!hasConversation) return;

    try {
      setSending(true);
      setError('');
      const response: ButlerChatResponse = await butlerService.send({
        conversationId,
        restaurantId,
        confirmation: { actionId: draftAction.actionId, confirmed },
      });

      if (response.reply) {
        addMessage('assistant', response.reply);
      }
      if (response.error) setError(response.error.message);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The draft action could not be completed.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="df-butler-backdrop" onClick={onClose} role="presentation">
      <aside className="df-butler-panel" onClick={(event) => event.stopPropagation()} aria-label="Butler assistant panel">
        <header className="df-butler-header">
          <div>
            <p className="df-butler-eyebrow">DINEFLOW AI</p>
            <h2>Butler</h2>
          </div>
          <button type="button" className="df-butler-close" onClick={onClose} aria-label="Close Butler">✕</button>
        </header>

        <div className="df-butler-body">
          {messages.map((message) => (
            <div key={message.id} className={`df-butler-message ${message.role}`}>
              <span className="df-butler-role">{message.role === 'assistant' ? 'Butler' : 'You'}</span>
              <p>{message.text}</p>
              {message.draftAction && (
                <div className="df-butler-draft">
                  <strong>{message.draftAction.summary}</strong>
                  <small>{message.draftAction.toolName}</small>
                  <div className="df-butler-draft-actions">
                    <button type="button" onClick={() => void handleDraftConfirmation(message.draftAction!, true)}>Confirm</button>
                    <button type="button" className="secondary" onClick={() => void handleDraftConfirmation(message.draftAction!, false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {error && <div className="df-butler-alert">{error}</div>}
        </div>

        <form className="df-butler-input-row" onSubmit={(event) => void handleSend(event)}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder={restaurantId ? 'Ask Butler about the menu or a new item…' : 'Restaurant context is missing. Please refresh your access.'}
            disabled={sending || !restaurantId}
          />
          <button type="submit" disabled={sending || !restaurantId || !input.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </aside>
    </div>
  );
}
