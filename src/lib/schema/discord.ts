import {
    type APIAvatarDecorationData,
    type APIGuildWelcomeScreen,
    type APIGuildWelcomeScreenChannel,
    type APIPartialChannel,
    type APIPartialEmoji,
    type APIPartialGuild,
    type APIUser,
    type APIWebhook,
    ChannelType,
    GuildFeature,
    GuildVerificationLevel,
    UserFlags,
    UserPremiumType,
    WebhookType,
} from "discord-api-types/v10"
import * as v from "valibot"

import { id } from "../utils/fp"

/**
 * https://discord.com/developers/docs/reference#snowflakes
 */
export const $Snowflake = v.string()

/**
 * https://discord.com/developers/docs/resources/user#avatar-decoration-data-object
 */
export const $APIAvatarDecorationData = v.pipe(
    v.object({
        /**
         * The avatar decoration hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         */
        asset: v.string(),
        /**
         * The id of the avatar decoration's SKU
         */
        sku_id: $Snowflake,
    }),
    v.transform(id<APIAvatarDecorationData>),
)

/**
 * https://discord.com/developers/docs/resources/user#user-object-user-flags
 */
export const $UserFlags = v.enum(UserFlags)

/**
 * https://discord.com/developers/docs/resources/user#user-object-premium-types
 */
export const $UserPremiumType = v.enum(UserPremiumType)

/**
 * https://discord.com/developers/docs/resources/user#user-object
 */
export const $APIUser = v.pipe(
    v.object({
        /**
         * The user's id
         */
        id: $Snowflake,
        /**
         * The user's username, not unique across the platform
         */
        username: v.string(),
        /**
         * The user's Discord-tag
         */
        discriminator: v.string(),
        /**
         * The user's display name, if it is set. For bots, this is the application name
         */
        global_name: v.nullable(v.string()),
        /**
         * The user's avatar hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         */
        avatar: v.nullable(v.string()),
        /**
         * Whether the user belongs to an OAuth2 application
         */
        bot: v.optional(v.boolean()),
        /**
         * Whether the user is an Official Discord System user (part of the urgent message system)
         */
        system: v.optional(v.boolean()),
        /**
         * Whether the user has two factor enabled on their account
         */
        mfa_enabled: v.optional(v.boolean()),
        /**
         * The user's banner hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         */
        banner: v.optional(v.nullable(v.string())),
        /**
         * The user's banner color encoded as an integer representation of hexadecimal color code
         */
        accent_color: v.optional(v.nullable(v.number())),
        /**
         * The user's chosen language option
         */
        locale: v.optional(v.string()),
        /**
         * Whether the email on this account has been verified
         */
        verified: v.optional(v.boolean()),
        /**
         * The user's email
         */
        email: v.optional(v.nullable(v.string())),
        /**
         * The flags on a user's account
         *
         * See https://discord.com/developers/docs/resources/user#user-object-user-flags
         */
        flags: v.optional($UserFlags),
        /**
         * The type of Nitro subscription on a user's account
         *
         * See https://discord.com/developers/docs/resources/user#user-object-premium-types
         */
        premium_type: v.optional($UserPremiumType),
        /**
         * The public flags on a user's account
         *
         * See https://discord.com/developers/docs/resources/user#user-object-user-flags
         */
        public_flags: v.optional($UserFlags),
        /**
         * The user's avatar decoration hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         *
         * @deprecated Use `avatar_decoration_data` instead
         */
        avatar_decoration: v.optional(v.nullable(v.string())),
        /**
         * The data for the user's avatar decoration
         *
         * See https://discord.com/developers/docs/resources/user#avatar-decoration-data-object
         */
        avatar_decoration_data: v.optional(v.nullable($APIAvatarDecorationData)),
    }),
    v.transform(id<APIUser>),
)

/**
 * https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types
 */
export const $WebhookType = v.enum(WebhookType)

/**
 * https://discord.com/developers/docs/resources/guild#guild-object-guild-features
 */
export const $GuildFeature = v.enum(GuildFeature)

/**
 * https://discord.com/developers/docs/resources/guild#guild-object-verification-level
 */
export const $GuildVerificationLevel = v.enum(GuildVerificationLevel)

export const $APIGuildWelcomeScreenChannel = v.pipe(
    v.object({
        /**
         * The channel id that is suggested
         */
        channel_id: $Snowflake,
        /**
         * The description shown for the channel
         */
        description: v.string(),
        /**
         * The emoji id of the emoji that is shown on the left of the channel
         */
        emoji_id: v.nullable($Snowflake),
        /**
         * The emoji name of the emoji that is shown on the left of the channel
         */
        emoji_name: v.nullable(v.string()),
    }),
    v.transform(id<APIGuildWelcomeScreenChannel>),
)

export const $APIGuildWelcomeScreen = v.pipe(
    v.object({
        /**
         * The welcome screen short message
         */
        description: v.nullable(v.string()),
        /**
         * Array of suggested channels
         */
        welcome_channels: v.array($APIGuildWelcomeScreenChannel),
    }),
    v.transform(id<APIGuildWelcomeScreen>),
)

/**
 * https://discord.com/developers/docs/resources/guild#guild-object-guild-structure
 */
export const $APIPartialGuild = v.pipe(
    v.object({
        /**
         * Guild id
         *
         * Inherited from `Omit<APIUnavailableGuild, 'unavailable'>`
         */
        id: $Snowflake,
        /**
         * The welcome screen of a Community guild, shown to new members
         *
         * Returned in the invite object
         *
         * Inherited from `Pick<APIGuild, 'welcome_screen'>`
         */
        welcome_screen: v.optional($APIGuildWelcomeScreen),
        /**
         * Guild name (2-100 characters, excluding trailing and leading whitespace)
         */
        name: v.string(),
        /**
         * Icon hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         */
        icon: v.nullable(v.string()),
        /**
         * Splash hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         */
        splash: v.nullable(v.string()),
        /**
         * Banner hash
         *
         * See https://discord.com/developers/docs/reference#image-formatting
         */
        banner: v.optional(v.nullable(v.string())),
        /**
         * The description for the guild
         */
        description: v.optional(v.nullable(v.string())),
        /**
         * Enabled guild features
         *
         * See https://discord.com/developers/docs/resources/guild#guild-object-guild-features
         */
        features: v.optional(v.array($GuildFeature)),
        /**
         * Verification level required for the guild
         *
         * See https://discord.com/developers/docs/resources/guild#guild-object-verification-level
         */
        verification_level: v.optional($GuildVerificationLevel),
        /**
         * The vanity url code for the guild
         */
        vanity_url_code: v.optional(v.nullable(v.string())),
    }),
    v.transform((input): APIPartialGuild => input),
)

/**
 * https://discord.com/developers/docs/resources/channel#channel-object-channel-types
 */
export const $ChannelType = v.enum(ChannelType)

/**
 * Not documented, but partial only includes id, name, and type
 */
export const $APIPartialChannel = v.pipe(
    v.object({
        /**
         * The id of the channel
         */
        id: $Snowflake,
        /**
         * The type of the channel
         *
         * See https://discord.com/developers/docs/resources/channel#channel-object-channel-types
         */
        type: $ChannelType,
        /**
         * The name of the channel (1-100 characters)
         */
        name: v.optional(v.nullable(v.string())),
    }),
    v.transform(id<APIPartialChannel>),
)

/**
 * https://discord.com/developers/docs/resources/webhook#webhook-object
 */
export const $APIWebhook = v.pipe(
    v.object({
        /**
         * The id of the webhook
         */
        id: $Snowflake,
        /**
         * The type of the webhook
         *
         * See https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types
         */
        type: $WebhookType,
        /**
         * The guild id this webhook is for
         */
        guild_id: v.optional($Snowflake),
        /**
         * The channel id this webhook is for
         */
        channel_id: $Snowflake,
        /**
         * The user this webhook was created by (not returned when getting a webhook with its token)
         *
         * See https://discord.com/developers/docs/resources/user#user-object
         */
        user: v.optional($APIUser),
        /**
         * The default name of the webhook
         */
        name: v.nullable(v.string()),
        /**
         * The default avatar of the webhook
         */
        avatar: v.nullable(v.string()),
        /**
         * The secure token of the webhook (returned for Incoming Webhooks)
         */
        token: v.optional(v.string()),
        /**
         * The bot/OAuth2 application that created this webhook
         */
        application_id: v.nullable($Snowflake),
        /**
         * The guild of the channel that this webhook is following (returned for Channel Follower Webhooks)
         */
        source_guild: v.optional($APIPartialGuild),
        /**
         * The channel that this webhook is following (returned for Channel Follower Webhooks)
         */
        source_channel: v.optional($APIPartialChannel),
        /**
         * The url used for executing the webhook (returned by the webhooks OAuth2 flow)
         */
        url: v.optional(v.string()),
    }),
    v.transform(id<APIWebhook>),
)

/**
 * Not documented but mentioned
 */
export const $APIPartialEmoji = v.pipe(
    v.object({
        /**
         * Emoji id
         */
        id: v.nullable($Snowflake),
        /**
         * Emoji name (can be null only in reaction emoji objects)
         */
        name: v.nullable(v.string()),
        /**
         * Whether this emoji is animated
         */
        animated: v.optional(v.boolean()),
    }),
    v.transform(id<APIPartialEmoji>),
)
