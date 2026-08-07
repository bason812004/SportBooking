import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Send, Image as ImageIcon, Video as VideoIcon, X, Crown, UserMinus, LogOut, Loader2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { contentApi, type BlogWriteInput } from "../../features/content/api/contentApi";
import { useTeamPost, useTeamPostMessages } from "../../features/content/hooks/useContent";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { getSocket } from "../../lib/socket";
import { uploadApi, type UploadProgress } from "../../features/uploads/api/uploadApi";
import type { TeamPostMessage } from "../../types/api";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const messageTimeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

const REACTIONS = [
  { key: "like", emoji: "👍" },
  { key: "love", emoji: "❤️" },
  { key: "laugh", emoji: "😂" },
  { key: "wow", emoji: "😮" },
  { key: "sad", emoji: "😢" },
  { key: "clap", emoji: "👏" },
  { key: "fire", emoji: "🔥" }
] as const;

type TeamPostMessageWithReactions = TeamPostMessage & {
  reactions?: Array<{ reaction: string; userId: string }>;
};

type PendingMedia = {
  file: File;
  type: "IMAGE" | "VIDEO";
  previewUrl: string;
};

type GroupMember = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
};

export function TeamGroupChatPage() {
  const { id } = useParams();
  const post = useTeamPost(id);
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showReactionFor, setShowReactionFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const myMembership = useMemo(
    () => members.find((m) => m.userId === user?.id) ?? null,
    [members, user?.id]
  );
  const isPostOwner = post.data?.createdBy?.id === user?.id;
  const isMember = Boolean(myMembership) || isPostOwner;
  const isAdmin = isPostOwner || myMembership?.role === "OWNER" || myMembership?.role === "ADMIN";

  const messages = useTeamPostMessages(id, isMember);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.data?.length]);

  useEffect(() => {
    if (!id || !token) return;
    let cancelled = false;
    contentApi.teamPostMembers(id)
      .then((list) => { if (!cancelled) setMembers(list); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [id, token]);

  useEffect(() => {
    if (!id || !token) return;

    const socket = getSocket(token);
    const refreshPost = () => {
      queryClient.invalidateQueries({ queryKey: ["team-post", id] });
      queryClient.invalidateQueries({ queryKey: ["joined-team-posts"] });
    };
    const refreshMembers = () => contentApi.teamPostMembers(id).then(setMembers).catch(() => undefined);

    socket.emit("team-post:subscribe", id);

    const handleNewMessage = (newMsg: TeamPostMessageWithReactions) => {
      if (!newMsg || !newMsg.id) return;
      queryClient.setQueryData<TeamPostMessageWithReactions[]>(
        ["team-post-messages", id],
        (old) => {
          if (!old) return [newMsg];
          if (old.some((m) => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        }
      );
    };

    const handleNewReaction = (data: { messageId: string; userId: string; reaction: string }) => {
      if (!data?.messageId) return;
      queryClient.setQueryData<TeamPostMessageWithReactions[]>(
        ["team-post-messages", id],
        (old) => {
          if (!old) return old;
          return old.map((msg) => {
            if (msg.id !== data.messageId) return msg;
            const currentReactions = (msg.reactions ?? []).filter((r) => r.userId !== data.userId);
            currentReactions.push({ reaction: data.reaction, userId: data.userId });
            return { ...msg, reactions: currentReactions };
          });
        }
      );
    };

    const handleRemoveReaction = (data: { messageId: string; userId: string }) => {
      if (!data?.messageId) return;
      queryClient.setQueryData<TeamPostMessageWithReactions[]>(
        ["team-post-messages", id],
        (old) => {
          if (!old) return old;
          return old.map((msg) => {
            if (msg.id !== data.messageId) return msg;
            const currentReactions = (msg.reactions ?? []).filter((r) => r.userId !== data.userId);
            return { ...msg, reactions: currentReactions };
          });
        }
      );
    };

    socket.on("team-post:message:new", handleNewMessage);
    socket.on("team-post:reaction:new", handleNewReaction);
    socket.on("team-post:reaction:removed", handleRemoveReaction);
    socket.on("team-post:member-joined", () => {
      refreshPost();
      refreshMembers();
    });
    socket.on("team-post:member-left", refreshMembers);
    socket.on("team-post:member-removed", refreshMembers);
    socket.on("team-post:admin-transferred", refreshMembers);

    return () => {
      socket.emit("team-post:unsubscribe", id);
      socket.off("team-post:message:new", handleNewMessage);
      socket.off("team-post:reaction:new", handleNewReaction);
      socket.off("team-post:reaction:removed", handleRemoveReaction);
      socket.off("team-post:member-joined", refreshPost);
      socket.off("team-post:member-left", refreshMembers);
      socket.off("team-post:member-removed", refreshMembers);
      socket.off("team-post:admin-transferred", refreshMembers);
    };
  }, [id, queryClient, token]);

  async function joinGroup() {
    if (!id) return;
    try {
      await contentApi.joinTeamPost(id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-post", id] }),
        queryClient.invalidateQueries({ queryKey: ["team-post-messages", id] }),
        queryClient.invalidateQueries({ queryKey: ["joined-team-posts"] }),
        contentApi.teamPostMembers(id).then((list) => setMembers(list)).catch(() => undefined)
      ]);
      toast.success("Đã tham gia nhóm.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tham gia nhóm.");
    }
  }

  const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

  function handlePickMedia(file: File, kind: "IMAGE" | "VIDEO") {
    if (file.size > (kind === "IMAGE" ? 5 : 25) * 1024 * 1024) {
      toast.error(`File tối đa ${kind === "IMAGE" ? "5MB" : "25MB"}`);
      return;
    }
    if (kind === "VIDEO" && !ALLOWED_VIDEO_TYPES.has(file.type)) {
      toast.error("Chỉ chấp nhận video MP4, WebM hoặc MOV");
      return;
    }
    setPendingMedia({ file, type: kind, previewUrl: URL.createObjectURL(file) });
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!id) return;
    if (!content && !pendingMedia) return;

    setMessage("");
    const currentPendingMedia = pendingMedia;
    const previewUrl = currentPendingMedia?.previewUrl;
    if (currentPendingMedia) {
      setPendingMedia(null);
    }

    // Optimistic temporary message for text-only messages
    const tempId = `temp-${Date.now()}`;
    if (!currentPendingMedia && user) {
      const tempMsg: TeamPostMessageWithReactions = {
        id: tempId,
        postId: id,
        content,
        messageType: "TEXT",
        attachmentUrl: null,
        attachmentName: null,
        attachmentSize: null,
        thumbnailUrl: null,
        mimeType: null,
        createdAt: new Date().toISOString() as unknown as Date,
        updatedAt: new Date().toISOString() as unknown as Date,
        sender: { id: user.id, fullName: user.fullName || "Tôi", avatarUrl: user.avatarUrl || null },
        reactions: []
      };
      queryClient.setQueryData<TeamPostMessageWithReactions[]>(
        ["team-post-messages", id],
        (old) => (old ? [...old, tempMsg] : [tempMsg])
      );
    }

    setSending(true);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let attachmentSize: number | undefined;
    let thumbnailUrl: string | undefined;
    let mimeType: string | undefined;
    let messageType: "TEXT" | "IMAGE" | "VIDEO" = "TEXT";

    try {
      if (currentPendingMedia) {
        setUploadingMedia(true);
        setUploadProgress(null);
        const uploaded = currentPendingMedia.type === "IMAGE"
          ? await uploadApi.uploadTeamChatImage(id, currentPendingMedia.file, {
              onProgress: (p) => setUploadProgress(p)
            })
          : await uploadApi.uploadTeamChatVideo(id, currentPendingMedia.file, {
              onProgress: (p) => setUploadProgress(p)
            });
        attachmentUrl = uploaded.url;
        attachmentName = currentPendingMedia.file.name;
        attachmentSize = currentPendingMedia.file.size;
        mimeType = currentPendingMedia.file.type;
        messageType = currentPendingMedia.type;
        setUploadProgress(null);
        setUploadingMedia(false);
      }

      const created = await contentApi.createTeamPostMessage(id, {
        content: content || undefined,
        messageType,
        attachmentUrl,
        attachmentName,
        attachmentSize,
        thumbnailUrl,
        mimeType
      });

      if (created?.id) {
        queryClient.setQueryData<TeamPostMessageWithReactions[]>(
          ["team-post-messages", id],
          (old) => {
            if (!old) return [created];
            const filtered = old.filter((m) => m.id !== tempId);
            if (filtered.some((m) => m.id === created.id)) return filtered;
            return [...filtered, created];
          }
        );
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    } catch (error) {
      // Revert optimistic temp message on failure
      if (!currentPendingMedia) {
        queryClient.setQueryData<TeamPostMessageWithReactions[]>(
          ["team-post-messages", id],
          (old) => (old ? old.filter((m) => m.id !== tempId) : [])
        );
      }
      toast.error(error instanceof Error ? error.message : "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  }

  async function reactToMessage(messageId: string, reaction: string) {
    if (!id || !user) return;
    setShowReactionFor(null);
    // Optimistically update reactions cache
    queryClient.setQueryData<TeamPostMessageWithReactions[]>(
      ["team-post-messages", id],
      (old) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.id !== messageId) return msg;
          const currentReactions = (msg.reactions ?? []).filter((r) => r.userId !== user.id);
          currentReactions.push({ reaction, userId: user.id });
          return { ...msg, reactions: currentReactions };
        });
      }
    );
    try {
      await contentApi.reactToMessage(id, { messageId, reaction });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể reaction.");
      queryClient.invalidateQueries({ queryKey: ["team-post-messages", id] });
    }
  }

  async function removeReaction(messageId: string) {
    if (!id || !user) return;
    // Optimistically remove reaction from cache
    queryClient.setQueryData<TeamPostMessageWithReactions[]>(
      ["team-post-messages", id],
      (old) => {
        if (!old) return old;
        return old.map((msg) => {
          if (msg.id !== messageId) return msg;
          const currentReactions = (msg.reactions ?? []).filter((r) => r.userId !== user.id);
          return { ...msg, reactions: currentReactions };
        });
      }
    );
    try {
      await contentApi.removeReaction(id, messageId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa reaction.");
      queryClient.invalidateQueries({ queryKey: ["team-post-messages", id] });
    }
  }

  async function leaveGroup() {
    if (!id) return;
    const confirmMsg = isPostOwner
      ? "Bạn có chắc chắn muốn rời / giải tán nhóm này?"
      : "Bạn có chắc chắn muốn rời nhóm?";
    if (!confirm(confirmMsg)) return;
    try {
      await contentApi.leaveGroup(id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-post", id] }),
        queryClient.invalidateQueries({ queryKey: ["team-post-messages", id] }),
        queryClient.invalidateQueries({ queryKey: ["joined-team-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["team-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["my-team-posts"] })
      ]);
      const socket = getSocket(token ?? "");
      socket.emit("team-post:unsubscribe", id);
      toast.success(isPostOwner ? "Đã rời / giải tán nhóm." : "Đã rời nhóm.");
      navigate("/user/team-groups");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể rời nhóm.");
    }
  }

  async function removeMember(memberId: string) {
    if (!id) return;
    if (!confirm("Ban co chac muon xoa thanh vien nay khoi nhom?")) return;
    try {
      await contentApi.removeMember(id, memberId);
      toast.success("Đã xóa thành viên.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Khong the xoa thanh vien.");
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
              <p className="flex gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" />{group.playingDate ? dateFormat.format(new Date(group.playingDate)) : "Linh hoạt"} · {(group.startTime ?? "").slice(0, 5)} - {(group.endTime ?? "").slice(0, 5)}</p>
              <p className="flex gap-2"><UsersRound className="h-4 w-4 shrink-0 text-emerald-700" />{group.currentPlayers}/{group.maxPlayers} người</p>
            </div>
            <Link to={`/teammates/${group.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
              Xem chi tiết bài đăng
            </Link>
            {isMember && (
              <button
                onClick={() => void leaveGroup()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                {isPostOwner ? "Giải tán / Rời nhóm" : "Rời nhóm"}
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black">Thành viên ({members.length})</h2>
            <ul className="mt-3 max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.fullName} src={m.avatarUrl} />
                    <div>
                      <p className="text-sm font-black text-slate-800">{m.fullName}</p>
                      {m.role !== "MEMBER" && (
                        <p className="text-[11px] font-black uppercase text-emerald-700 flex items-center gap-1">
                          <Crown className="h-3 w-3" /> {m.role}
                        </p>
                      )}
                    </div>
                  </div>
                  {isAdmin && m.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.userId)}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                      title="Xóa khỏi nhóm"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="flex h-[78vh] min-h-[520px] max-h-[820px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-black">Chat nhóm</h2>
            <p className="text-sm font-semibold text-slate-500">Tin nhắn realtime cho nhóm chơi thể thao này.</p>
          </div>

          {!isMember ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-base font-black text-slate-800">Bạn cần tham gia nhóm để xem và gửi tin nhắn.</p>
              <p className="max-w-md text-sm text-slate-500">
                Sau khi tham gia, danh sách thành viên, tin nhắn và quyền chat sẽ cập nhật tự động theo thời gian thực.
              </p>
              <button
                type="button"
                onClick={joinGroup}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800"
              >
                Tham gia nhóm ngay
              </button>
            </div>
          ) : messages.isLoading ? (
            <div className="grid flex-1 place-items-center p-6"><LoadingState label="Đang tải tin nhắn..." /></div>
          ) : messages.isError ? (
            <div className="grid flex-1 place-items-center p-6">
              <ErrorState message={messages.error instanceof Error ? messages.error.message : "Không thể tải tin nhắn."} onRetry={() => void messages.refetch()} />
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
                {(() => {
                  const raw = (messages.data as TeamPostMessageWithReactions[] | undefined) ?? [];
                  const seen = new Set<string>();
                  const unique = raw.filter((m) => {
                    if (!m?.id || seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                  });

                  if (!unique.length) {
                    return (
                      <div className="m-auto rounded-2xl bg-white p-5 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                        Chưa có tin nhắn nào. Hãy bắt đầu trao đổi lịch chơi.
                      </div>
                    );
                  }

                  return unique.map((chat) => {
                    const senderId = chat.sender?.id;
                    const senderName = chat.sender?.fullName ?? "Thành viên";
                    const senderAvatar = chat.sender?.avatarUrl ?? null;
                    const mine = Boolean(senderId && user?.id && senderId === user.id);
                    const reactionsByEmoji = new Map<string, number>();
                    (chat.reactions ?? []).forEach((r) => {
                      reactionsByEmoji.set(r.reaction, (reactionsByEmoji.get(r.reaction) ?? 0) + 1);
                    });
                    const myReaction = (chat.reactions ?? []).find((r) => r.userId === user?.id);

                    const handleTouchStart = () => {
                      longPressTimer.current = window.setTimeout(() => setShowReactionFor(chat.id), 350);
                    };
                    const handleTouchEnd = () => {
                      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                    };

                    return (
                      <div
                        key={chat.id}
                        className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                        onMouseDown={handleTouchStart}
                        onMouseUp={handleTouchEnd}
                        onMouseLeave={handleTouchEnd}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                      >
                        {!mine && <Avatar name={senderName} src={senderAvatar} />}
                        <div className="relative max-w-[78%]">
                          <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-700 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
                            {!mine && <p className="mb-1 text-xs font-black text-emerald-700">{senderName}</p>}
                            <MessageBody chat={chat} mine={mine} />
                            <p className={`mt-1 text-[11px] ${mine ? "text-emerald-50/80" : "text-slate-400"}`}>{messageTimeFormat.format(new Date(chat.createdAt))}</p>
                          </div>

                          {reactionsByEmoji.size > 0 && (
                            <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                              {Array.from(reactionsByEmoji.entries()).map(([key, count]) => {
                                const item = REACTIONS.find((r) => r.key === key);
                                if (!item) return null;
                                const isMine = myReaction?.reaction === key;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => isMine ? removeReaction(chat.id) : reactToMessage(chat.id, key)}
                                    className={`rounded-full border px-2 py-0.5 text-xs ${isMine ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}
                                  >
                                    <span className="mr-1">{item.emoji}</span>{count}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {showReactionFor === chat.id && (
                            <div className={`absolute z-10 mt-1 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg ${mine ? "right-0" : "left-0"}`}>
                              {REACTIONS.map((r) => (
                                <button
                                  key={r.key}
                                  type="button"
                                  onClick={() => reactToMessage(chat.id, r.key)}
                                  className="rounded-lg p-1.5 text-lg hover:bg-slate-100"
                                >
                                  {r.emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {mine && <Avatar name={senderName} src={senderAvatar} />}
                      </div>
                    );
                  });
                })()}
                <div ref={messagesEndRef} />
              </div>

              {pendingMedia && (
                <div className="border-t border-slate-200 bg-slate-50 p-3">
                  <div className="relative inline-block">
                    {pendingMedia.type === "IMAGE" ? (
                      <img src={pendingMedia.previewUrl} alt="preview" className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200" />
                    ) : (
                      <video src={pendingMedia.previewUrl} controls className="h-24 w-32 rounded-xl ring-1 ring-slate-200" />
                    )}
                    <button
                      type="button"
                      onClick={() => { URL.revokeObjectURL(pendingMedia.previewUrl); setPendingMedia(null); setUploadProgress(null); }}
                      disabled={uploadingMedia}
                      className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white shadow disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {uploadingMedia && uploadProgress && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                        <div className="text-center">
                          <p className="text-xs font-black text-white">{uploadProgress.percent}%</p>
                          <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/30">
                            <div
                              className="h-full bg-emerald-400 transition-all"
                              style={{ width: `${uploadProgress.percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 p-4">
                <label className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Gửi ảnh">
                  <ImageIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePickMedia(file, "IMAGE");
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Gửi video">
                  <VideoIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePickMedia(file, "VIDEO");
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  placeholder="Nhập tin nhắn..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-600"
                />
                <button type="submit" disabled={sending || (!message.trim() && !pendingMedia)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50">
                  {sending || uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {uploadingMedia ? "Đang tải lên..." : "Gửi"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function MessageBody({ chat, mine }: { chat: TeamPostMessageWithReactions; mine: boolean }) {
  if (chat.messageType === "IMAGE" && chat.attachmentUrl) {
    return (
      <a href={chat.attachmentUrl} target="_blank" rel="noreferrer" className="block">
        <img src={chat.attachmentUrl} alt={chat.attachmentName ?? "image"} className="max-h-72 max-w-full rounded-xl object-contain" />
        {chat.content && <p className="mt-1 whitespace-pre-wrap break-words">{chat.content}</p>}
      </a>
    );
  }
  if (chat.messageType === "VIDEO" && chat.attachmentUrl) {
    return (
      <div>
        <video src={chat.attachmentUrl} controls className="max-h-72 max-w-full rounded-xl" />
        {chat.content && <p className="mt-1 whitespace-pre-wrap break-words">{chat.content}</p>}
      </div>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{chat.content}</p>;
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}
