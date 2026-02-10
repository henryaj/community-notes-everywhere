class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :twitter_uid, null: false
      t.string :twitter_handle
      t.string :display_name
      t.string :avatar_url
      t.integer :follower_count
      t.datetime :account_created_at
      t.float :reputation_score, default: 0.0
      t.string :auth_token

      t.timestamps
    end

    add_index :users, :twitter_uid, unique: true
    add_index :users, :auth_token, unique: true
  end
end
