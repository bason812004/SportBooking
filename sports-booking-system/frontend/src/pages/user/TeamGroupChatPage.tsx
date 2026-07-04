import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Send, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { contentApi } from "../../features/content/api/contentApi";
import { useTeamPost, useTeamPostMessages } from "../../features/content/hooks/useContent";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { getSocket } from "../../lib/socket";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const messageTimeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export function TeamGroupChatPage() {
  const { id } = useParams();
  const post = useTeamPost(id);
  const messages = useTeamPostMessages(id);
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.data?.length]);

  useEffect(() => {
    if (!id || !token || messages.isError) return;

    const socket = getSocket(token);
    const refreshMessages = () => {
      void queryClient.invalidateQueries({ queryKey: ["team-post-messages", id] });
    };
    const refreshPost = () => {
      void queryClient.invalidateQueries({ queryKey: ["team-post", id] });
      void queryClient.invalidateQueries({ queryKey: ["joined-team-posts"] });
    };

    socket.emit("team-post:subscribe", id);
    socket.on("team-post:message:new", refreshMessages);
    socket.on("team-post:member-joined", refreshPost);

    return () => {
      socket.emit("team-post:unsubscribe", id);
      socket.off("team-post:message:new", refreshMessages);
      socket.off("team-post:member-joined", refreshPost);
    };
  }, [id, messages.isError, queryClient, token]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!id || !content) return;

    setSending(true);
    try {
      await contentApi.createTeamPostMessage(id, content);
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["team-post-messages", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  }

  if (post.isLoading) return <div className="px-4 py-16"><LoadingState label="Đang tải nhóm..." /></div>;
  if (post.isError) return <div className="px-4 py-16"><ErrorState message={post.error.message || "Không thể tải nhóm."} onRetry={() => void post.refetch()} /></div>;
  if (!post.data) return <div className="px-4 py-16"><EmptyState title="Không tìm thấy nhóm." /></div>;

  const group = post.data;

  return (
    <main className="bg-[#f5f7fb] px-4 py-8 text-slate-950">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:text-emerald-900">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{group.sportType}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{group.status}</span>
            </div>
            <h1 className="mt-4 text-2xl font-black leading-tight">{group.title}</h1>
            <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
              <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-emerald-700" />{group.courtName} - {group.address}</p>
              <p className="flex gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" />{group.playingDate ? dateFormat.format(new Date(group.playingDate)) : "Linh hoạt"} · {group.startTime.slice(0, 5)} - {group.endTime.slice(0, 5)}</p>
              <p className="flex gap-2"><UsersRound className="h-4 w-4 shrink-0 text-emerald-700" />{group.currentPlayers}/{group.maxPlayers} người</p>
            </div>
            <Link to={`/teammates/${group.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
              Xem chi tiết bài đăng
            </Link>
          </section>
        </aside>

        <section className="flex min-h-[72vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-black">Chat nhóm</h2>
            <p className="text-sm font-semibold text-slate-500">Tin nhắn realtime cho nhóm chơi thể thao này.</p>
          </div>

          {messages.isLoading ? (
            <div className="grid flex-1 place-items-center p-6"><LoadingState label="Đang tải tin nhắn..." /></div>
          ) : messages.isError ? (
            <div className="grid flex-1 place-items-center p-6">
              <ErrorState message="Bạn cần tham gia nhóm để xem và gửi tin nhắn." />
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
                {messages.data?.length ? (
                  messages.data.map((chat) => {
                    const mine = chat.sender.id === user?.id;
                    return (
                      <div key={chat.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine && <Avatar name={chat.sender.fullName} src={chat.sender.avatarUrl} />}
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-700 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
                          {!mine && <p className="mb-1 text-xs font-black text-emerald-700">{chat.sender.fullName}</p>}
                          <p className="whitespace-pre-wrap break-words">{chat.content}</p>
                          <p className={`mt-1 text-[11px] ${mine ? "text-emerald-50/80" : "text-slate-400"}`}>{messageTimeFormat.format(new Date(chat.createdAt))}</p>
                        </div>
                        {mine && <Avatar name={chat.sender.fullName} src={chat.sender.avatarUrl} />}
                      </div>
                    );
                  })
                ) : (
                  <div className="m-auto rounded-2xl bg-white p-5 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                    Chưa có tin nhắn nào. Hãy bắt đầu trao đổi lịch chơi.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-3 border-t border-slate-200 p-4">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  placeholder="Nhập tin nhắn..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-600"
                />
                <button type="submit" disabled={sending || !message.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  Gửi
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}
