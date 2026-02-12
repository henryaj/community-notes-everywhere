class User < ApplicationRecord
  include Flipper::Identifier
  MIN_RATING_REPUTATION = 15
  MIN_WRITING_REPUTATION = 25

  has_many :notes, foreign_key: :author_id, dependent: :destroy
  has_many :ratings, dependent: :destroy

  validates :twitter_uid, presence: true, uniqueness: true
  validates :twitter_handle, uniqueness: true, allow_nil: true

  enum :role, { user: 0, admin: 1, superadmin: 2 }
  def admin_or_above? = admin? || superadmin?

  before_create :generate_auth_token

  def self.find_or_create_from_oauth(auth)
    user = find_or_initialize_by(twitter_uid: auth.uid)
    user.twitter_handle = auth.info.nickname
    user.display_name = auth.info.name
    user.avatar_url = auth.info.image
    raw_data = auth.extra.raw_info.is_a?(Hash) ? (auth.extra.raw_info["data"] || auth.extra.raw_info) : auth.extra.raw_info
    user.follower_count = raw_data.dig("public_metrics", "followers_count") rescue nil
    user.account_created_at = raw_data["created_at"] rescue nil
    user.save!
    user.recalculate_reputation!
    user
  end

  def can_rate?
    reputation_score >= MIN_RATING_REPUTATION
  end

  def can_write?
    reputation_score >= MIN_WRITING_REPUTATION
  end

  def can_request_ai_notes?
    Flipper.enabled?(:ai_notes, self)
  end

  def recalculate_reputation!
    score = 0.0

    # Account age bonus (up to 20 points for accounts > 5 years old)
    if account_created_at
      years_old = (Time.current - account_created_at) / 1.year
      score += [ years_old * 4, 20 ].min
    end

    # Follower count bonus (logarithmic, up to 30 points)
    if follower_count && follower_count > 0
      score += [ Math.log10(follower_count) * 10, 30 ].min
    end

    # Rating accuracy bonus (up to 50 points)
    decided_yes_no = ratings.joins(:note)
      .where(notes: { status: [ :helpful, :not_helpful ] })
      .where(helpfulness: [ :yes, :no ])
    total_decided = decided_yes_no.count
    if total_decided > 0
      accurate_count = decided_yes_no
        .where("(ratings.helpfulness = 0 AND notes.status = 1) OR (ratings.helpfulness = 2 AND notes.status = 2)")
        .count
      score += (accurate_count.to_f / total_decided) * 50
    end

    update!(reputation_score: score.round(2))
  end

  def public_notes
    notes.where("reports_count < 3").order(created_at: :desc)
  end

  def profile_stats
    {
      total_notes: notes.count,
      helpful_count: notes.helpful.count,
      not_helpful_count: notes.not_helpful.count,
      pending_count: notes.pending.count
    }
  end

  def recalculate_rating_impact!
    # Notes rated by this user that reached a decided status
    decided_note_ids = ratings.joins(:note)
      .where(notes: { status: [ :helpful, :not_helpful ] })
      .pluck(:note_id)

    consensus_count = decided_note_ids.size

    # Early rater bonus: user was among the first 5 raters for these notes
    early_count = 0
    if decided_note_ids.any?
      early_count = Rating.where(note_id: decided_note_ids, user_id: id)
        .where(
          "id <= (SELECT r2.id FROM ratings r2 WHERE r2.note_id = ratings.note_id ORDER BY r2.id LIMIT 1 OFFSET 4)"
        ).count
    end

    impact = (consensus_count * 0.7) + (early_count * 1.5)
    update!(rating_impact: impact.round(2))
  end

  def recalculate_karma!
    total = notes.sum("helpful_count + somewhat_count * 0.5 - not_helpful_count")
    update!(karma: total.round(2))
  end

  private

  def generate_auth_token
    self.auth_token = SecureRandom.hex(32)
  end
end
