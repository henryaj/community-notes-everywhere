class User < ApplicationRecord
  MIN_RATING_REPUTATION = 15
  MIN_WRITING_REPUTATION = 25

  has_many :notes, foreign_key: :author_id, dependent: :destroy
  has_many :ratings, dependent: :destroy

  validates :twitter_uid, presence: true, uniqueness: true

  enum :role, { user: 0, admin: 1, superadmin: 2 }
  def admin_or_above? = admin? || superadmin?

  before_create :generate_auth_token

  def self.find_or_create_from_oauth(auth)
    user = find_or_initialize_by(twitter_uid: auth.uid)
    user.twitter_handle = auth.info.nickname
    user.display_name = auth.info.name
    user.avatar_url = auth.info.image
    user.follower_count = auth.extra.raw_info.public_metrics&.followers_count rescue nil
    user.account_created_at = auth.extra.raw_info.created_at rescue nil
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

  def recalculate_reputation!
    score = 0.0

    # Account age bonus (up to 20 points for accounts > 5 years old)
    if account_created_at
      years_old = (Time.current - account_created_at) / 1.year
      score += [years_old * 4, 20].min
    end

    # Follower count bonus (logarithmic, up to 30 points)
    if follower_count && follower_count > 0
      score += [Math.log10(follower_count) * 10, 30].min
    end

    # Rating accuracy bonus (up to 50 points)
    decided_yes_no = ratings.joins(:note)
      .where(notes: { status: [:helpful, :not_helpful] })
      .where(helpfulness: [:yes, :no])
    total_decided = decided_yes_no.count
    if total_decided > 0
      accurate_count = decided_yes_no
        .where("(ratings.helpfulness = 0 AND notes.status = 1) OR (ratings.helpfulness = 2 AND notes.status = 2)")
        .count
      score += (accurate_count.to_f / total_decided) * 50
    end

    update!(reputation_score: score.round(2))
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
